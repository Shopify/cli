import {selectOrCreateApp} from './dev/select-app.js'
import {fetchOrganizations} from './dev/fetch.js'
import {ensureDeploymentIdsPresence} from './context/identifiers.js'
import {CachedAppInfo} from './local-storage.js'
import {patchAppConfigurationFile} from './app/patch-app-configuration-file.js'
import {DeployOptions} from './deploy.js'
import {isServiceAccount, isUserAccount} from './context/partner-account-info.js'
import {selectOrganizationPrompt} from '../prompts/dev.js'
import {AppInterface, CurrentAppConfiguration, AppLinkedInterface} from '../models/app/app.js'
import {Identifiers, updateAppIdentifiers, getAppIdentifiers} from '../models/app/identifiers.js'
import {Organization, OrganizationApp, OrganizationStore} from '../models/organization.js'
import metadata from '../metadata.js'
import {getAppConfigurationFileName} from '../models/app/loader.js'

import {
  CreateAppOptions,
  DeveloperPlatformClient,
  selectDeveloperPlatformClient,
} from '../utilities/developer-platform-client.js'
import {tryParseInt} from '@shopify/cli-kit/common/string'
import {Token, TokenItem, renderInfo, renderWarning} from '@shopify/cli-kit/node/ui'
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
  organizationId?: string
  developerPlatformClient: DeveloperPlatformClient
}

export const appFromIdentifiers = async (options: AppFromIdOptions): Promise<OrganizationApp> => {
  let organizationId = options.organizationId
  let developerPlatformClient = options.developerPlatformClient
  if (!organizationId) {
    organizationId = '0'
    const org = await selectOrg()
    developerPlatformClient = selectDeveloperPlatformClient({organization: org})
    organizationId = org.id
  }
  const app = await developerPlatformClient.appFromIdentifiers({
    apiKey: options.apiKey,
    organizationId,
  })
  if (!app) {
    const accountInfo = await developerPlatformClient.accountInfo()
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
  const {force, noRelease, app, remoteApp, developerPlatformClient} = options
  const activeAppVersion = await developerPlatformClient.activeAppVersion(remoteApp)

  await removeIncludeConfigOnDeployField(app)

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

  return identifiers
}

async function removeIncludeConfigOnDeployField(localApp: AppInterface) {
  const configuration = localApp.configuration as CurrentAppConfiguration
  const includeConfigOnDeploy = configuration.build?.include_config_on_deploy
  if (includeConfigOnDeploy === undefined) return

  const patch = {build: {include_config_on_deploy: undefined}}
  await patchAppConfigurationFile({path: localApp.configuration.path, patch, schema: localApp.configSchema})

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

export async function fetchOrCreateOrganizationApp(options: CreateAppOptions): Promise<OrganizationApp> {
  const org = await selectOrg()
  const developerPlatformClient = selectDeveloperPlatformClient({organization: org})
  const {organization, apps, hasMorePages} = await developerPlatformClient.orgAndApps(org.id)
  const remoteApp = await selectOrCreateApp(apps, hasMorePages, organization, developerPlatformClient, options)
  remoteApp.developerPlatformClient = developerPlatformClient

  await logMetadataForLoadedContext(remoteApp)

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

export async function logMetadataForLoadedContext(app: {apiKey: string; organizationId: string}) {
  const orgIdKey = 'business_platform_id'
  const organizationInfo = {[orgIdKey]: tryParseInt(app.organizationId)}

  await metadata.addPublicMetadata(() => ({
    ...organizationInfo,
    api_key: app.apiKey,
  }))
}
