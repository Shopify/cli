/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {selectOrCreateApp} from './dev/select-app.js'
import {fetchOrganizations} from './dev/fetch.js'
import {ensureDeploymentIdsPresence} from './context/identifiers.js'
import {createExtension} from './dev/create-extension.js'
import {CachedAppInfo} from './local-storage.js'
import {patchAppConfigurationFile} from './app/patch-app-configuration-file.js'
import {DeployOptions} from './deploy.js'
import {selectOrganizationPrompt} from '../prompts/dev.js'
import {
  AppInterface,
  isCurrentAppSchema,
  CurrentAppConfiguration,
  AppCreationDefaultOptions,
  AppLinkedInterface,
  isLegacyAppSchema,
} from '../models/app/app.js'
import {Identifiers, updateAppIdentifiers, getAppIdentifiers} from '../models/app/identifiers.js'
import {Organization, OrganizationApp, OrganizationStore} from '../models/organization.js'
import metadata from '../metadata.js'
import {getAppConfigurationFileName} from '../models/app/loader.js'
import {ExtensionInstance} from '../models/extensions/extension-instance.js'

import {ExtensionRegistration} from '../api/graphql/all_app_extension_registrations.js'
import {
  DevelopmentStorePreviewUpdateInput,
  DevelopmentStorePreviewUpdateSchema,
} from '../api/graphql/development_preview.js'
import {DeveloperPlatformClient, selectDeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {tryParseInt} from '@shopify/cli-kit/common/string'
import {Token, TokenItem, renderConfirmationPrompt, renderInfo} from '@shopify/cli-kit/node/ui'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent} from '@shopify/cli-kit/node/output'
import {basename, sniffForJson} from '@shopify/cli-kit/node/path'

export const InvalidApiKeyErrorMessage = (apiKey: string) => {
  return {
    message: outputContent`Invalid Client ID: ${apiKey}`,
    tryMessage: outputContent`You can find the Client ID in the app settings in the Partners Dashboard.`,
  }
}

export const resetHelpMessage: Token[] = [
  'You can pass ',
  {command: '--reset'},
  ' to your command to reset your app configuration.',
]

interface AppFromIdOptions {
  apiKey: string
  id?: string
  organizationId?: string
  developerPlatformClient: DeveloperPlatformClient
}

export const appFromId = async (options: AppFromIdOptions): Promise<OrganizationApp> => {
  let organizationId = options.organizationId
  let developerPlatformClient = options.developerPlatformClient
  if (!organizationId) {
    organizationId = '0'
    if (developerPlatformClient.requiresOrganization) {
      const org = await selectOrg()
      developerPlatformClient = selectDeveloperPlatformClient({organization: org})
      organizationId = org.id
    }
  }
  const app = await developerPlatformClient.appFromId({
    id: options.id ?? 'no-id-available',
    apiKey: options.apiKey,
    organizationId,
  })
  if (!app) throw new AbortError([`Couldn't find the app with Client ID`, {command: options.apiKey}], resetHelpMessage)
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

  if (remoteRegistrations.length > 0) {
    return remoteRegistrations[0]!
  }

  const registration = await createExtension(apiKey, extension.graphQLType, extension.handle, developerPlatformClient)

  return registration
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
export async function ensureDeployContext(options: DeployOptions): Promise<Identifiers> {
  const {reset, force, noRelease, app, remoteApp, developerPlatformClient, organization} = options
  const activeAppVersion = await developerPlatformClient.activeAppVersion(remoteApp)

  await checkIncludeConfigOnDeploy({org: organization, app, remoteApp, reset, force, developerPlatformClient})

  const identifiers = await ensureDeploymentIdsPresence({
    app,
    appId: remoteApp.apiKey,
    appName: remoteApp.title,
    force,
    release: !noRelease,
    developerPlatformClient,
    envIdentifiers: getAppIdentifiers({app}, developerPlatformClient),
    remoteApp,
    activeAppVersion,
  })

  await updateAppIdentifiers({app, identifiers, command: 'deploy', developerPlatformClient})

  return identifiers
}

interface ShouldOrPromptIncludeConfigDeployOptions {
  appDirectory: string
  localApp: AppInterface
}

async function checkIncludeConfigOnDeploy({
  org,
  app,
  remoteApp,
  reset,
  force,
  developerPlatformClient,
}: {
  org: Organization
  app: AppInterface
  remoteApp: OrganizationApp
  reset: boolean
  force: boolean
  developerPlatformClient: DeveloperPlatformClient
}) {
  if (
    developerPlatformClient.supportsAtomicDeployments &&
    !isLegacyAppSchema(app.configuration) &&
    app.configuration.build?.include_config_on_deploy
  ) {
    await removeIncludeConfigOnDeployField(app)
    return
  }

  let previousIncludeConfigOnDeploy = app.includeConfigOnDeploy
  if (reset) previousIncludeConfigOnDeploy = undefined
  if (force) previousIncludeConfigOnDeploy = previousIncludeConfigOnDeploy ?? false

  renderCurrentlyUsedConfigInfo({
    org: org.businessName,
    appName: remoteApp.title,
    appDotEnv: app.dotenv?.path,
    configFile: isCurrentAppSchema(app.configuration) ? basename(app.configuration.path) : undefined,
    resetMessage: resetHelpMessage,
    includeConfigOnDeploy: previousIncludeConfigOnDeploy,
  })

  if (force || previousIncludeConfigOnDeploy === true) return
  await promptIncludeConfigOnDeploy({
    appDirectory: app.directory,
    localApp: app,
  })
}

async function removeIncludeConfigOnDeployField(localApp: AppInterface) {
  const patch = {build: {include_config_on_deploy: undefined}}
  await patchAppConfigurationFile({path: localApp.configuration.path, patch, schema: localApp.configSchema})
  const message = {
    headline: `Your configuration file has been modified`,
    body: [
      `The \`include_config_on_deploy\` field is no longer supported, since all apps must now include configuration on deploy. It has been removed from your configuration file.`,
    ],
    link: {
      label: 'See Shopify CLI documentation.',
      url: 'https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration#build',
    },
  }
  return renderInfo(message)
}

async function promptIncludeConfigOnDeploy(options: ShouldOrPromptIncludeConfigDeployOptions) {
  const shouldIncludeConfigDeploy = await includeConfigOnDeployPrompt(options.localApp.configuration.path)
  const localConfiguration = options.localApp.configuration as CurrentAppConfiguration
  const patch = {build: {include_config_on_deploy: shouldIncludeConfigDeploy}}
  await patchAppConfigurationFile({path: localConfiguration.path, patch, schema: options.localApp.configSchema})
  await metadata.addPublicMetadata(() => ({cmd_deploy_confirm_include_config_used: shouldIncludeConfigDeploy}))
}

function includeConfigOnDeployPrompt(configPath: string): Promise<boolean> {
  return renderConfirmationPrompt({
    message: `Include \`${basename(
      configPath,
    )}\` configuration on \`deploy\`? Soon, this will no longer be an option, and configuration will need to be included on deploy every time.`,
    confirmationMessage: 'Yes (Recommended)',
    cancellationMessage: 'No, not now',
  })
}

export async function fetchOrCreateOrganizationApp(
  options: AppCreationDefaultOptions,
  directory?: string,
): Promise<OrganizationApp> {
  const {isLaunchable, scopesArray, name} = options
  const org = await selectOrg()
  const developerPlatformClient = selectDeveloperPlatformClient({organization: org})
  const {organization, apps, hasMorePages} = await developerPlatformClient.orgAndApps(org.id)
  const remoteApp = await selectOrCreateApp(name, apps, hasMorePages, organization, developerPlatformClient, {
    isLaunchable,
    scopesArray,
    directory,
  })
  remoteApp.developerPlatformClient = developerPlatformClient

  await logMetadataForLoadedContext({organizationId: remoteApp.organizationId, apiKey: remoteApp.apiKey})

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
}

/**
 * Message shown to the user in case we are reusing a previous configuration
 */
export function showReusedDevValues({organization, app, remoteApp, selectedStore, cachedInfo}: ReusedValuesOptions) {
  if (!cachedInfo) return
  if (sniffForJson()) return

  let updateURLs = 'Not yet configured'
  const updateURLsValue = app.configuration.build?.automatically_update_urls_on_dev
  if (updateURLsValue !== undefined) updateURLs = updateURLsValue ? 'Yes' : 'No'

  renderCurrentlyUsedConfigInfo({
    org: organization.businessName,
    appName: remoteApp.title,
    devStore: selectedStore.shopDomain,
    updateURLs,
    configFile: cachedInfo.configFile,
    resetMessage: resetHelpMessage,
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
  resetMessage?: Token[]
}

export function formInfoBoxBody(
  appName: string,
  org?: string,
  devStores?: string[],
  resetMessage?: Token[],
  updateURLs?: string,
  includeConfigOnDeploy?: boolean,
): TokenItem {
  const items = [`App:             ${appName}`]
  if (org) items.unshift(`Org:             ${org}`)
  if (devStores && devStores.length > 0) {
    devStores.forEach((storeUrl) => items.push(`Dev store:       ${storeUrl}`))
  }
  if (updateURLs) items.push(`Update URLs:     ${updateURLs}`)
  if (includeConfigOnDeploy !== undefined) items.push(`Include config:  ${includeConfigOnDeploy ? 'Yes' : 'No'}`)

  let body: TokenItem = [{list: {items}}]
  if (resetMessage) body = [...body, '\n', ...resetMessage]

  return body
}

export function renderCurrentlyUsedConfigInfo({
  org,
  appName,
  devStore,
  updateURLs,
  configFile,
  appDotEnv,
  resetMessage,
  includeConfigOnDeploy,
}: CurrentlyUsedConfigInfoOptions): void {
  const devStores = []
  if (devStore) devStores.push(devStore)

  const body = formInfoBoxBody(appName, org, devStores, resetMessage, updateURLs, includeConfigOnDeploy)
  const fileName = (appDotEnv && basename(appDotEnv)) || (configFile && getAppConfigurationFileName(configFile))
  renderInfo({
    headline: configFile ? `Using ${fileName} for default values:` : 'Using these settings:',
    body,
  })
}

export async function logMetadataForLoadedContext(app: {organizationId: string; apiKey: string}) {
  await metadata.addPublicMetadata(() => ({
    partner_id: tryParseInt(app.organizationId),
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
