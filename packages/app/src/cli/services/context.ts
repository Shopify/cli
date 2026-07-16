import {selectOrCreateApp} from './dev/select-app.js'
import {fetchOrganizations, fetchOrgFromId} from './dev/fetch.js'
import {ensureDeployIdentifiersFromAppVersion} from './context/deploy-identifier-matching.js'
import {CachedAppInfo} from './local-storage.js'
import {DeployOptions} from './deploy.js'
import {formatConfigInfoBody} from './format-config-info-body.js'
import {AppInterface, AppLinkedInterface} from '../models/app/app.js'
import {DeployIdentifiers, getAppIdentifiers} from '../models/app/identifiers.js'
import {Organization, OrganizationApp, OrganizationSource, OrganizationStore} from '../models/organization.js'
import metadata from '../metadata.js'
import {getAppConfigurationFileName} from '../models/app/loader.js'

import {CreateAppOptions, defaultDeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {selectOrganizationPrompt} from '@shopify/organizations'
import {TomlFile} from '@shopify/cli-kit/node/toml/toml-file'
import {isServiceAccount, isUserAccount} from '@shopify/cli-kit/node/session'
import {tryParseInt} from '@shopify/cli-kit/common/string'
import {Token, renderInfo, renderWarning} from '@shopify/cli-kit/node/ui'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent} from '@shopify/cli-kit/node/output'
import {basename, sniffForJson} from '@shopify/cli-kit/node/path'

export const InvalidApiKeyErrorMessage = (apiKey: string) => {
  return {
    message: outputContent`Invalid Client ID: ${apiKey}`,
    tryMessage: outputContent`You can find the Client ID in the app settings in the Developer Dashboard.`,
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
          {command: 'shopify auth login'},
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
  const client = defaultDeveloperPlatformClient()
  const app = await client.appFromIdentifiers(options.apiKey)

  if (!app) {
    const accountInfo = (await client.accountInfo()) ?? {type: 'UnknownAccount'}
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

interface EnsureDeployContextResult {
  deployIdentifiers: DeployIdentifiers
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
  const {noRelease, app, remoteApp, developerPlatformClient, organization} = options
  const activeAppVersion = await developerPlatformClient.activeAppVersion(remoteApp)

  await removeIncludeConfigOnDeployField(app)

  renderCurrentlyUsedConfigInfo({
    org: organization.businessName,
    appName: remoteApp.title,
    appDotEnv: app.dotenv?.path,
    configFile: basename(app.configPath),
    messages: [resetHelpMessage],
  })

  const deployIdentifiers = await ensureDeployIdentifiersFromAppVersion({
    app,
    appId: remoteApp.apiKey,
    appName: remoteApp.title,
    release: !noRelease,
    developerPlatformClient,
    envIdentifiers: getAppIdentifiers({app}),
    remoteApp,
    activeAppVersion,
    allowUpdates: options.allowUpdates,
    allowDeletes: options.allowDeletes,
  })

  // if the current active app version is missing user_identifiers in some app module, then we are migrating to dev dash
  let didMigrateExtensionsToDevDash = false
  if (activeAppVersion) {
    didMigrateExtensionsToDevDash = activeAppVersion.appModuleVersions.some((version) => !version.registrationId)
  }

  return {deployIdentifiers, didMigrateExtensionsToDevDash}
}

async function removeIncludeConfigOnDeployField(localApp: AppInterface) {
  const includeConfigOnDeploy = localApp.configuration.build?.include_config_on_deploy
  if (includeConfigOnDeploy === undefined) return

  const configFile = await TomlFile.read(localApp.configPath)
  await configFile.remove('build.include_config_on_deploy')

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

export async function fetchOrCreateOrganizationApp(
  options: CreateAppOptions & {organizationId?: string},
): Promise<OrganizationApp> {
  const developerPlatformClient = defaultDeveloperPlatformClient()
  const org = options.organizationId
    ? await fetchOrgFromId(options.organizationId, developerPlatformClient)
    : await selectOrg()
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
  if (orgs.length === 0) {
    throw new AbortError('No organizations found.', 'Make sure you have access to a Shopify organization.')
  }
  return selectOrganizationPrompt(orgs)
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
    configFile: basename(app.configPath),
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
  messages?: Token[][]
}

export function renderCurrentlyUsedConfigInfo({
  org,
  appName,
  devStore,
  updateURLs,
  configFile,
  appDotEnv,
  messages,
}: CurrentlyUsedConfigInfoOptions): void {
  const devStores = []
  if (devStore) devStores.push(devStore)

  const fileName = (appDotEnv && basename(appDotEnv)) ?? (configFile && getAppConfigurationFileName(configFile))

  renderInfo({
    headline: configFile ? `Using ${fileName} for default values:` : 'Using these settings:',
    body: formatConfigInfoBody({appName, org, devStores, updateURLs, messages}),
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
