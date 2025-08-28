import {selectOrCreateApp} from './dev/select-app.js'
import {fetchOrganizations} from './dev/fetch.js'
import {ensureDeploymentIdsPresence} from './context/identifiers.js'
import {createExtension} from './dev/create-extension.js'
import {CachedAppInfo} from './local-storage.js'
import {setAppConfigValue, unsetAppConfigValue} from './app/patch-app-configuration-file.js'
import {DeployOptions} from './deploy.js'
import {isServiceAccount, isUserAccount} from './context/partner-account-info.js'
import {formatConfigInfoBody} from './format-config-info-body.js'
import {selectOrganizationPrompt} from '../prompts/dev.js'
import {AppInterface, CurrentAppConfiguration, AppLinkedInterface} from '../models/app/app.js'
import {Identifiers, updateAppIdentifiers, getAppIdentifiers} from '../models/app/identifiers.js'
import {Organization, OrganizationApp, OrganizationSource, OrganizationStore} from '../models/organization.js'
import metadata from '../metadata.js'
import {getAppConfigurationFileName} from '../models/app/loader.js'
import {ExtensionInstance} from '../models/extensions/extension-instance.js'

import {ExtensionRegistration} from '../api/graphql/all_app_extension_registrations.js'
import {
  DevelopmentStorePreviewUpdateInput,
  DevelopmentStorePreviewUpdateSchema,
} from '../api/graphql/development_preview.js'
import {
  allDeveloperPlatformClients,
  CreateAppOptions,
  DeveloperPlatformClient,
  selectDeveloperPlatformClient,
} from '../utilities/developer-platform-client.js'
import {tryParseInt} from '@shopify/cli-kit/common/string'
import {Token, renderConfirmationPrompt, renderInfo, renderWarning} from '@shopify/cli-kit/node/ui'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent} from '@shopify/cli-kit/node/output'
import {basename, sniffForJson} from '@shopify/cli-kit/node/path'

export const InvalidApiKeyErrorMessage = (apiKey: string) => {
  return {
    message: outputContent`Invalid Client ID: ${apiKey}`,
    tryMessage: outputContent`You can find the Client ID in the app settings in the Partners Dashboard.`,
  }
}

export const resetHelpMessage = [
  'You can pass',
  {command: '--reset'},
  'to your command to reset your app configuration.',
]

const appNotFoundHelpMessage = (accountIdentifier: string, isOrg = false) => [
  {
    list: {
      title: 'Next steps:',
      items: [
        'Check that your account has permission to develop apps for this organization or contact the owner of the organization to grant you permission',
        [
          'Run',
          {command: 'shopify auth logout'},
          'to log into a different',
          isOrg ? 'organization' : 'account',
          'than',
          {bold: accountIdentifier},
        ],
        ['Pass', {command: '--reset'}, 'to your command to create a new app'],
      ],
    },
  },
]

interface AppFromIdOptions {
  apiKey: string
}

export const appFromIdentifiers = async (options: AppFromIdOptions): Promise<OrganizationApp> => {
  const allClients = allDeveloperPlatformClients()

  let app: OrganizationApp | undefined
  for (const client of allClients) {
    try {
      // eslint-disable-next-line no-await-in-loop
      app = await client.appFromIdentifiers(options.apiKey)
      if (app) break
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if ('statusCode' in error && error.statusCode === 404) {
        // We don't want to throw an error if the first client can't find the app. Try the next client.
        continue
      }
      throw error
    }
  }

  if (!app) {
    const accountInfo = (await allClients[0]?.accountInfo()) ?? {type: 'UnknownAccount'}
    let identifier = 'Unknown account'
    let isOrg = false

    if (isServiceAccount(accountInfo)) {
      identifier = accountInfo.orgName
      isOrg = true
    } else if (isUserAccount(accountInfo)) {
      identifier = accountInfo.email
    }

    throw new AbortError(
      [`No app with client ID`, {command: options.apiKey}, 'found'],
      appNotFoundHelpMessage(identifier, isOrg),
    )
  }
  return app
}

export async function ensureThemeExtensionDevContext(
  extension: ExtensionInstance,
  apiKey: string,
  developerPlatformClient: DeveloperPlatformClient,
): Promise<ExtensionRegistration> {
  const remoteSpecifications = await developerPlatformClient.appExtensionRegistrations({
    id: apiKey,
    apiKey,
    organizationId: '1',
  })
  const remoteRegistrations = remoteSpecifications.app.extensionRegistrations.filter((extension) => {
    return extension.type === 'THEME_APP_EXTENSION'
  })

  if (remoteRegistrations[0]) {
    return remoteRegistrations[0]
  }

  const registration = await createExtension(apiKey, extension.graphQLType, extension.handle, developerPlatformClient)

  return registration
}

interface EnsureDeployContextResult {
  identifiers: Identifiers
  didMigrateExtensionsToDevDash: boolean
}

/**
 * Make sure there is a valid context to execute `deploy`
 * That means we have a valid session, organization and app.
 *
 * If there is an API key via flag, configuration or env file, we check if it is valid. Otherwise, throw an error.
 * If there is no app (or is invalid), show prompts to select an org and app.
 * Finally, the info is updated in the env file.
 *
 * @param options - Current dev context options
 * @param developerPlatformClient - The client to access the platform API
 * @returns The selected org, app and dev store
 */
export async function ensureDeployContext(options: DeployOptions): Promise<EnsureDeployContextResult> {
  const {reset, force, noRelease, app, remoteApp, developerPlatformClient, organization} = options
  const activeAppVersion = await developerPlatformClient.activeAppVersion(remoteApp)

  const includeConfigOnDeploy = await checkIncludeConfigOnDeploy({app, reset, force, developerPlatformClient})

  renderCurrentlyUsedConfigInfo({
    org: organization.businessName,
    appName: remoteApp.title,
    appDotEnv: app.dotenv?.path,
    configFile: basename(app.configuration.path),
    includeConfigOnDeploy,
    messages: [resetHelpMessage],
  })

  const identifiers = await ensureDeploymentIdsPresence({
    app,
    appId: remoteApp.apiKey,
    appName: remoteApp.title,
    force,
    release: !noRelease,
    developerPlatformClient,
    envIdentifiers: getAppIdentifiers({app}),
    remoteApp,
    activeAppVersion,
  })

  await updateAppIdentifiers({app, identifiers, command: 'deploy', developerPlatformClient})

  // if the current active app version is missing user_identifiers in some app module, then we are migrating to dev dash
  let didMigrateExtensionsToDevDash = false
  if (developerPlatformClient.supportsAtomicDeployments && activeAppVersion) {
    didMigrateExtensionsToDevDash = activeAppVersion.appModuleVersions.some((version) => !version.registrationId)
  }

  return {identifiers, didMigrateExtensionsToDevDash}
}

interface ShouldOrPromptIncludeConfigDeployOptions {
  appDirectory: string
  localApp: AppInterface
}

async function checkIncludeConfigOnDeploy({
  app,
  reset,
  force,
  developerPlatformClient,
}: {
  app: AppInterface
  reset: boolean
  force: boolean
  developerPlatformClient: DeveloperPlatformClient
}): Promise<boolean | undefined> {
  if (developerPlatformClient.supportsAtomicDeployments) {
    await removeIncludeConfigOnDeployField(app)
    return undefined
  }

  let includeConfigOnDeploy = app.includeConfigOnDeploy
  if (reset) includeConfigOnDeploy = undefined

  if (force && includeConfigOnDeploy === undefined) {
    // If a partner is deploying on CI/CD with include_config_on_deploy not set,
    // we need to abort the deploy, because the default value changed to true.
    const message = [
      'You must specify a value for',
      {command: 'include_config_on_deploy'},
      'in your TOML file. Including configuration will be required very soon.',
    ]
    const nextSteps = ['Run', {command: 'shopify app deploy'}, 'interactively, without', {command: '--force'}, '.']
    throw new AbortError(message, nextSteps)
  }

  if (force || includeConfigOnDeploy === true) return includeConfigOnDeploy

  return promptAndSaveIncludeConfigOnDeploy({
    appDirectory: app.directory,
    localApp: app,
  })
}

async function removeIncludeConfigOnDeployField(localApp: AppInterface) {
  const configuration = localApp.configuration as CurrentAppConfiguration
  const includeConfigOnDeploy = configuration.build?.include_config_on_deploy
  if (includeConfigOnDeploy === undefined) return

  await unsetAppConfigValue(localApp.configuration.path, 'build.include_config_on_deploy')

  includeConfigOnDeploy ? renderInfoAboutIncludeConfigOnDeploy() : renderWarningAboutIncludeConfigOnDeploy()
}

function renderInfoAboutIncludeConfigOnDeploy() {
  renderInfo({
    headline: `Your configuration file has been modified`,
    body: [
      `The \`include_config_on_deploy\` field is no longer supported, since all apps must now include configuration on deploy. It has been removed from your configuration file.`,
    ],
    link: {
      label: 'See Shopify CLI documentation.',
      url: 'https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration#build',
    },
  })
}

function renderWarningAboutIncludeConfigOnDeploy() {
  renderWarning({
    headline: `Configuration is now included on deploy`,
    body: [
      `The \`include_config_on_deploy\` field is no longer supported and has been removed from your configuration file. Review this file to ensure it's up to date with the correct configuration.`,
    ],
    link: {
      label: 'See Shopify CLI documentation.',
      url: 'https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration#build',
    },
  })
}

async function promptAndSaveIncludeConfigOnDeploy(options: ShouldOrPromptIncludeConfigDeployOptions): Promise<boolean> {
  const shouldIncludeConfigDeploy = await includeConfigOnDeployPrompt(options.localApp.configuration.path)
  const localConfiguration = options.localApp.configuration as CurrentAppConfiguration
  localConfiguration.build = {
    ...localConfiguration.build,
    include_config_on_deploy: shouldIncludeConfigDeploy,
  }
  await setAppConfigValue(localConfiguration.path, 'build.include_config_on_deploy', shouldIncludeConfigDeploy)
  await metadata.addPublicMetadata(() => ({cmd_deploy_confirm_include_config_used: shouldIncludeConfigDeploy}))
  return shouldIncludeConfigDeploy
}

function includeConfigOnDeployPrompt(configPath: string): Promise<boolean> {
  return renderConfirmationPrompt({
    message: `Include \`${basename(
      configPath,
    )}\` configuration on \`deploy\`? Soon, this will no longer be optional and configuration will be included on every deploy.`,
    confirmationMessage: 'Yes, always (Recommended)',
    cancellationMessage: 'No, not now',
  })
}

export async function fetchOrCreateOrganizationApp(options: CreateAppOptions): Promise<OrganizationApp> {
  const org = await selectOrg()
  const developerPlatformClient = selectDeveloperPlatformClient({organization: org})
  const {organization, apps, hasMorePages} = await developerPlatformClient.orgAndApps(org.id)
  const remoteApp = await selectOrCreateApp(apps, hasMorePages, organization, developerPlatformClient, options)

  await logMetadataForLoadedContext(remoteApp, developerPlatformClient.organizationSource)

  return remoteApp
}

/**
 * Fetch all orgs the user belongs to and show a prompt to select one of them
 * @param developerPlatformClient - The client to access the platform API
 * @returns The selected organization ID
 */
export async function selectOrg(): Promise<Organization> {
  const orgs = await fetchOrganizations()
  const org = await selectOrganizationPrompt(orgs)
  return org
}

interface ReusedValuesOptions {
  organization: Organization
  app: AppLinkedInterface
  remoteApp: OrganizationApp
  selectedStore: OrganizationStore
  cachedInfo?: CachedAppInfo
  tunnelMode?: string
}

/**
 * Message shown to the user in case we are reusing a previous configuration
 */
export function showReusedDevValues({organization, app, remoteApp, selectedStore, tunnelMode}: ReusedValuesOptions) {
  if (sniffForJson()) return

  let updateURLs = 'Not yet configured'
  const updateURLsValue = app.configuration.build?.automatically_update_urls_on_dev
  if (updateURLsValue !== undefined) updateURLs = updateURLsValue ? 'Yes' : 'No'

  const messages = [resetHelpMessage]

  if (tunnelMode === 'use-localhost') {
    messages.push([
      'Note:',
      {command: '--use-localhost'},
      'is not compatible with Shopify features which directly invoke your app',
      '(such as Webhooks, App proxy, and Flow actions), or those which require testing your app from another',
      'device (such as POS).',
    ])
  }

  renderCurrentlyUsedConfigInfo({
    org: organization.businessName,
    appName: remoteApp.title,
    devStore: selectedStore.shopDomain,
    updateURLs,
    configFile: basename(app.configuration.path),
    messages,
  })
}
interface CurrentlyUsedConfigInfoOptions {
  appName: string
  org?: string
  devStore?: string
  updateURLs?: string
  configFile?: string
  appDotEnv?: string
  includeConfigOnDeploy?: boolean
  messages?: Token[][]
}

export function renderCurrentlyUsedConfigInfo({
  org,
  appName,
  devStore,
  updateURLs,
  configFile,
  appDotEnv,
  includeConfigOnDeploy,
  messages,
}: CurrentlyUsedConfigInfoOptions): void {
  const devStores = []
  if (devStore) devStores.push(devStore)

  const fileName = (appDotEnv && basename(appDotEnv)) ?? (configFile && getAppConfigurationFileName(configFile))

  renderInfo({
    headline: configFile ? `Using ${fileName} for default values:` : 'Using these settings:',
    body: formatConfigInfoBody({appName, org, devStores, updateURLs, includeConfigOnDeploy, messages}),
  })
}

export async function logMetadataForLoadedContext(
  app: {apiKey: string; organizationId: string},
  organizationSource: OrganizationSource,
) {
  const orgIdKey = organizationSource === OrganizationSource.BusinessPlatform ? 'business_platform_id' : 'partner_id'
  const organizationInfo = {[orgIdKey]: tryParseInt(app.organizationId)}

  await metadata.addPublicMetadata(() => ({
    ...organizationInfo,
    api_key: app.apiKey,
  }))
}

export async function enableDeveloperPreview({
  apiKey,
  developerPlatformClient,
}: {
  apiKey: string
  developerPlatformClient: DeveloperPlatformClient
}) {
  return developerPreviewUpdate({apiKey, developerPlatformClient, enabled: true})
}

export async function disableDeveloperPreview({
  apiKey,
  developerPlatformClient,
}: {
  apiKey: string
  developerPlatformClient: DeveloperPlatformClient
}) {
  await developerPreviewUpdate({apiKey, developerPlatformClient, enabled: false})
}

export async function developerPreviewUpdate({
  apiKey,
  developerPlatformClient,
  enabled,
}: {
  apiKey: string
  developerPlatformClient: DeveloperPlatformClient
  enabled: boolean
}) {
  const input: DevelopmentStorePreviewUpdateInput = {
    input: {
      apiKey,
      enabled,
    },
  }
  const result: DevelopmentStorePreviewUpdateSchema = await developerPlatformClient.updateDeveloperPreview(input)
  const userErrors = result.developmentStorePreviewUpdate.userErrors
  return !userErrors || userErrors.length === 0
}
