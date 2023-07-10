import {selectOrCreateApp} from './dev/select-app.js'
import {
  fetchAllDevStores,
  fetchAppFromApiKey,
  fetchOrgAndApps,
  fetchOrganizations,
  fetchOrgFromId,
  fetchStoreByDomain,
  FetchResponse,
  fetchAppExtensionRegistrations,
} from './dev/fetch.js'
import {convertToTestStoreIfNeeded, selectStore} from './dev/select-store.js'
import {ensureDeploymentIdsPresence} from './context/identifiers.js'
import {createExtension} from './dev/create-extension.js'
import {CachedAppInfo, clearAppInfo, getAppInfo, setAppInfo} from './local-storage.js'
import {DeploymentMode, resolveDeploymentMode} from './deploy/mode.js'
import {reuseDevConfigPrompt, selectOrganizationPrompt} from '../prompts/dev.js'
import {AppConfiguration, AppInterface, isCurrentAppSchema, appIsLaunchable} from '../models/app/app.js'
import {Identifiers, UuidOnlyIdentifiers, updateAppIdentifiers, getAppIdentifiers} from '../models/app/identifiers.js'
import {Organization, OrganizationApp, OrganizationStore} from '../models/organization.js'
import metadata from '../metadata.js'
import {getAppConfigurationFileName, loadAppConfiguration, loadAppName} from '../models/app/loader.js'
import {ExtensionInstance} from '../models/extensions/extension-instance.js'
import {
  DevelopmentStorePreviewUpdateInput,
  DevelopmentStorePreviewUpdateQuery,
  DevelopmentStorePreviewUpdateSchema,
} from '../api/graphql/development_preview.js'
import {ExtensionRegistration} from '../api/graphql/all_app_extension_registrations.js'
import {getPackageManager, PackageManager} from '@shopify/cli-kit/node/node-package-manager'
import {tryParseInt} from '@shopify/cli-kit/common/string'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {renderInfo, renderTasks} from '@shopify/cli-kit/node/ui'
import {partnersFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError, AbortSilentError, BugError} from '@shopify/cli-kit/node/error'
import {
  outputContent,
  outputInfo,
  outputToken,
  formatPackageManagerCommand,
  outputNewline,
  outputCompleted,
  outputWarn,
} from '@shopify/cli-kit/node/output'
import {getOrganization} from '@shopify/cli-kit/node/environment'
import {writeFileSync} from '@shopify/cli-kit/node/fs'
import {encodeToml} from '@shopify/cli-kit/node/toml'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {basename} from '@shopify/cli-kit/node/path'

export const InvalidApiKeyErrorMessage = (apiKey: string) => {
  return {
    message: outputContent`Invalid Client ID: ${apiKey}`,
    tryMessage: outputContent`You can find the Client ID in the app settings in the Partners Dashboard.`,
  }
}

export interface DevContextOptions {
  directory: string
  apiKey?: string
  config?: string
  storeFqdn?: string
  reset: boolean
}

interface DevContextOutput {
  remoteApp: Omit<OrganizationApp, 'apiSecretKeys'> & {apiSecret?: string}
  remoteAppUpdated: boolean
  storeFqdn: string
  updateURLs: boolean | undefined
  useCloudflareTunnels: boolean
  config?: string
  deploymentMode: DeploymentMode
}

/**
 * Make sure there is a valid context to execute `generate extension`
 *
 * We just need a valid app API key to access the Specifications API.
 * - If the API key is provided via flag, we use it.
 * - Else, if there is an API key in the current config or cache, we use it.
 * - Else, we prompt the user to select/create an app.
 *
 * The selection is then cached as the "dev" app for the current directory.
 */
export async function ensureGenerateContext(options: {
  apiKey?: string
  directory: string
  reset: boolean
  token: string
  config?: string
}): Promise<string> {
  if (options.apiKey) {
    const app = await fetchAppFromApiKey(options.apiKey, options.token)
    if (!app) {
      const errorMessage = InvalidApiKeyErrorMessage(options.apiKey)
      throw new AbortError(errorMessage.message, errorMessage.tryMessage)
    }
    return app.apiKey
  }

  const {cachedInfo, remoteApp} = await getAppDevCachedContext(options)

  if (cachedInfo === undefined && !options.reset) {
    const explanation =
      `\nLooks like this is the first time you're running 'generate extension' for this project.\n` +
      'Configure your preferences by answering a few questions.\n'
    outputInfo(explanation)
  }

  if (cachedInfo?.appId && cachedInfo?.orgId) {
    const org = await fetchOrgFromId(cachedInfo.orgId, options.token)
    const app = remoteApp || (await fetchAppFromApiKey(cachedInfo.appId, options.token))
    if (!app || !org) {
      const errorMessage = InvalidApiKeyErrorMessage(cachedInfo.appId)
      throw new AbortError(errorMessage.message, errorMessage.tryMessage)
    }
    const packageManager = await getPackageManager(options.directory)
    showGenerateReusedValues(org.businessName, cachedInfo, packageManager)
    return app.apiKey
  } else {
    const orgId = cachedInfo?.orgId || (await selectOrg(options.token))
    const {organization, apps} = await fetchOrgAndApps(orgId, options.token)
    const localAppName = await loadAppName(options.directory)
    const selectedApp = await selectOrCreateApp(localAppName, apps, organization, options.token)
    setAppInfo({
      appId: selectedApp.apiKey,
      title: selectedApp.title,
      directory: options.directory,
      orgId,
    })
    return selectedApp.apiKey
  }
}

/**
 * Make sure there is a valid context to execute `dev`
 * That means we have a valid organization, app and dev store selected.
 *
 * If there are app/store from flags, we check if they are valid. If they are not, throw an error.
 * If there is info in the cache or current configuration, check if it is still valid and return it.
 * If there is no info (or is invalid):
 *  - Show prompts to select an org, app and dev store
 *  - The info will be updated in the cache or current configuration
 *
 * @param options - Current dev context options
 * @returns The selected org, app and dev store
 */
export async function ensureDevContext(options: DevContextOptions, token: string): Promise<DevContextOutput> {
  const {configuration, configurationPath, cachedInfo, remoteApp} = await getAppDevCachedContext({...options, token})

  if (cachedInfo === undefined && !options.reset) {
    const explanation =
      `\nLooks like this is the first time you're running dev for this project.\n` +
      'Configure your preferences by answering a few questions.\n'
    outputInfo(explanation)
  }

  const orgId = getOrganization() || cachedInfo?.orgId || (await selectOrg(token))

  let {app: selectedApp, store: selectedStore} = await fetchDevDataFromOptions(options, orgId, token)
  const organization = await fetchOrgFromId(orgId, token)
  const useCloudflareTunnels = organization.betas?.cliTunnelAlternative !== true

  if (!selectedApp || !selectedStore) {
    // if we have selected an app or a dev store from a command flag, we keep them
    // if not, we try to load the app or the dev store from the current config or cache
    // if that's not available, we prompt the user to choose an existing one or create a new one
    const [_selectedApp, _selectedStore] = await Promise.all([
      selectedApp || remoteApp || (cachedInfo?.appId && appFromId(cachedInfo.appId, token)),
      selectedStore || (cachedInfo?.storeFqdn && storeFromFqdn(cachedInfo.storeFqdn, orgId, token)),
    ])

    if (_selectedApp) {
      selectedApp = _selectedApp
    } else {
      const {apps} = await fetchOrgAndApps(orgId, token)
      const localAppName = await loadAppName(options.directory)
      selectedApp = await selectOrCreateApp(localAppName, apps, organization, token)
    }

    if (_selectedStore) {
      selectedStore = _selectedStore
    } else {
      const allStores = await fetchAllDevStores(orgId, token)
      selectedStore = await selectStore(allStores, organization, token)
    }
  }

  if (isCurrentAppSchema(configuration)) {
    if (cachedInfo) cachedInfo.storeFqdn = selectedStore?.shopDomain
    const newConfiguration: AppConfiguration = {
      ...configuration,
      cli: {
        ...configuration.cli,
        dev_store_url: selectedStore?.shopDomain,
      },
    }
    writeFileSync(configurationPath, encodeToml(newConfiguration))
  } else {
    setAppInfo({
      appId: selectedApp.apiKey,
      title: selectedApp.title,
      directory: options.directory,
      storeFqdn: selectedStore?.shopDomain,
      orgId,
    })
  }

  await showDevReusedValues({
    directory: options.directory,
    selectedApp,
    selectedStore,
    cachedInfo,
    organization,
  })

  await enableDeveloperPreview(selectedApp, token)
  const deploymentMode = selectedApp.betas?.unifiedAppDeployment ? 'unified' : 'legacy'
  const result = buildOutput(selectedApp, selectedStore, useCloudflareTunnels, deploymentMode, cachedInfo)
  await logMetadataForLoadedDevContext(result)
  return result
}

const resetHelpMessage = ['You can pass', {command: '--reset'}, 'to your command to reset your config']

const appFromId = async (appId: string, token: string): Promise<OrganizationApp> => {
  const app = await fetchAppFromApiKey(appId, token)
  if (!app) throw new BugError([`Couldn't find the app with Client ID`, {command: appId}], resetHelpMessage)
  return app
}

const storeFromFqdn = async (storeFqdn: string, orgId: string, token: string): Promise<OrganizationStore> => {
  const result = await fetchStoreByDomain(orgId, token, storeFqdn)
  if (result?.store) {
    await convertToTestStoreIfNeeded(result.store, orgId, token)
    return result.store
  } else {
    throw new BugError(`Couldn't find the store with domain "${storeFqdn}". ${resetHelpMessage}`)
  }
}

function buildOutput(
  app: OrganizationApp,
  store: OrganizationStore,
  useCloudflareTunnels: boolean,
  deploymentMode: DeploymentMode,
  cachedInfo?: CachedAppInfo,
): DevContextOutput {
  return {
    remoteApp: {
      ...app,
      apiSecret: app.apiSecretKeys.length === 0 ? undefined : app.apiSecretKeys[0]!.secret,
    },
    remoteAppUpdated: app.apiKey !== cachedInfo?.previousAppId,
    storeFqdn: store.shopDomain,
    updateURLs: cachedInfo?.updateURLs,
    useCloudflareTunnels,
    config: cachedInfo?.configFile,
    deploymentMode,
  }
}

export interface DeployContextOptions {
  app: AppInterface
  apiKey?: string
  reset: boolean
  force: boolean
  noRelease: boolean
  commitReference?: string
}

export interface ReleaseContextOptions {
  app: AppInterface
  apiKey?: string
  reset: boolean
  force: boolean
}

interface ReleaseContextOutput {
  apiKey: string
  token: string
  app: AppInterface
}

interface DeployContextOutput {
  app: AppInterface
  token: string
  partnersApp: Omit<OrganizationApp, 'apiSecretKeys' | 'apiKey'>
  identifiers: Identifiers
  deploymentMode: DeploymentMode
}

/**
 * If there is a cached ApiKey used for dev, retrieve that and ask the user if they want to reuse it
 * @param app - The local app object
 * @param token - The token to use to access the Partners API
 * @returns
 * OrganizationApp if a cached value is valid.
 * undefined if there is no cached value or the user doesn't want to use it.
 */
export async function fetchDevAppAndPrompt(app: AppInterface, token: string): Promise<OrganizationApp | undefined> {
  const devAppId = getAppInfo(app.directory)?.appId
  if (!devAppId) return undefined

  const partnersResponse = await fetchAppFromApiKey(devAppId, token)
  if (!partnersResponse) return undefined

  const org = await fetchOrgFromId(partnersResponse.organizationId, token)

  showDevValues(org.businessName ?? 'unknown', partnersResponse.title)
  const reuse = await reuseDevConfigPrompt()
  return reuse ? partnersResponse : undefined
}

export async function ensureThemeExtensionDevContext(
  extension: ExtensionInstance,
  apiKey: string,
  token: string,
): Promise<ExtensionRegistration> {
  const remoteSpecifications = await fetchAppExtensionRegistrations({token, apiKey})
  const remoteRegistrations = remoteSpecifications.app.extensionRegistrations.filter((extension) => {
    return extension.type === 'THEME_APP_EXTENSION'
  })

  if (remoteRegistrations.length > 0) {
    return remoteRegistrations[0]!
  }

  const registration = await createExtension(apiKey, extension.graphQLType, extension.localIdentifier, token)

  return registration
}

/**
 * Make sure there is a valid context to execute `deploy`
 * That means we have a valid session, organization and app.
 *
 * If there is an API key via flag, configuration or env file, we check if it is valid. Otherwise, throw an error.
 * If there is no API key (or is invalid), show prompts to select an org and app.
 * Finally, the info is updated in the env file.
 *
 * @param options - Current dev context options
 * @returns The selected org, app and dev store
 */
export async function ensureDeployContext(options: DeployContextOptions): Promise<DeployContextOutput> {
  const token = await ensureAuthenticatedPartners()
  const [partnersApp, envIdentifiers] = await fetchAppAndIdentifiers(options, token)

  if (!partnersApp.betas?.unifiedAppDeployment) {
    renderInfo({
      headline: [
        'Stay tuned for changes to',
        {command: formatPackageManagerCommand(options.app.packageManager, 'deploy')},
        {char: '.'},
      ],
      body: "Soon, you'll be able to release all your extensions at the same time, directly from Shopify CLI.",
      reference: [
        {
          link: {
            url: 'https://shopify.dev/docs/apps/deployment/simplified-deployment',
            label: 'Simplified extension deployment',
          },
        },
      ],
    })
  }

  const deploymentMode = await resolveDeploymentMode(partnersApp, options, token)

  if (deploymentMode === 'legacy' && options.commitReference) {
    throw new AbortError('The `source-control-url` flag is not supported for this app.')
  }

  let identifiers: Identifiers = envIdentifiers as Identifiers

  identifiers = await ensureDeploymentIdsPresence({
    app: options.app,
    appId: partnersApp.apiKey,
    appName: partnersApp.title,
    force: options.force,
    deploymentMode,
    token,
    envIdentifiers,
    partnersApp,
  })

  // eslint-disable-next-line no-param-reassign
  options = {
    ...options,
    app: await updateAppIdentifiers({app: options.app, identifiers, command: 'deploy'}),
  }

  await disableDeveloperPreview(partnersApp, token)

  const result = {
    app: options.app,
    partnersApp: {
      id: partnersApp.id,
      title: partnersApp.title,
      appType: partnersApp.appType,
      organizationId: partnersApp.organizationId,
      grantedScopes: partnersApp.grantedScopes,
      betas: partnersApp.betas,
      applicationUrl: partnersApp.applicationUrl,
      redirectUrlWhitelist: partnersApp.redirectUrlWhitelist,
    },
    identifiers,
    token,
    deploymentMode,
  }

  await logMetadataForLoadedDeployContext(result)
  return result
}

/**
 * Make sure there is a valid context to execute `release`
 * That means we have a valid session, organization and app.
 *
 * If there is an API key via flag, configuration or env file, we check if it is valid. Otherwise, throw an error.
 * If there is no API key (or is invalid), show prompts to select an org and app.
 * Finally, the info is updated in the env file.
 *
 * @param options - Current dev context options
 * @returns The selected org, app and dev store
 */
export async function ensureReleaseContext(options: ReleaseContextOptions): Promise<ReleaseContextOutput> {
  const token = await ensureAuthenticatedPartners()
  const [partnersApp, envIdentifiers] = await fetchAppAndIdentifiers(options, token)
  const identifiers: Identifiers = envIdentifiers as Identifiers

  const deploymentMode: DeploymentMode = partnersApp.betas?.unifiedAppDeployment ? 'unified' : 'legacy'
  if (deploymentMode === 'legacy') {
    throw new AbortSilentError()
  }

  // eslint-disable-next-line no-param-reassign
  options = {
    ...options,
    app: await updateAppIdentifiers({app: options.app, identifiers, command: 'release'}),
  }
  const result = {
    app: options.app,
    apiKey: partnersApp.apiKey,
    token,
  }

  await logMetadataForLoadedReleaseContext(result, partnersApp.organizationId)
  return result
}

export async function fetchOrCreateOrganizationApp(app: AppInterface, token: string): Promise<OrganizationApp> {
  const orgId = await selectOrg(token)
  const {organization, apps} = await fetchOrgsAppsAndStores(orgId, token)
  const isLaunchable = appIsLaunchable(app)
  const partnersApp = await selectOrCreateApp(app.name, apps, organization, token, isLaunchable)
  return partnersApp
}

export async function fetchAppAndIdentifiers(
  options: {
    app: AppInterface
    reset: boolean
    apiKey?: string
  },
  token: string,
): Promise<[OrganizationApp, Partial<UuidOnlyIdentifiers>]> {
  let envIdentifiers = getAppIdentifiers({app: options.app})
  let partnersApp: OrganizationApp | undefined

  if (isCurrentAppSchema(options.app.configuration)) {
    const apiKey = options.apiKey ?? options.app.configuration.client_id
    partnersApp = await appFromId(apiKey, token)
  } else if (options.reset) {
    envIdentifiers = {app: undefined, extensions: {}}
  } else if (envIdentifiers.app) {
    const apiKey = options.apiKey ?? envIdentifiers.app
    partnersApp = await appFromId(apiKey, token)
  } else {
    partnersApp = await fetchDevAppAndPrompt(options.app, token)
  }

  if (!partnersApp) {
    partnersApp = await fetchOrCreateOrganizationApp(options.app, token)
  }

  return [partnersApp, envIdentifiers]
}

async function fetchOrgsAppsAndStores(orgId: string, token: string): Promise<FetchResponse> {
  let data = {} as FetchResponse
  const tasks = [
    {
      title: 'Fetching organization data',
      task: async () => {
        const organizationAndApps = await fetchOrgAndApps(orgId, token)
        const stores = await fetchAllDevStores(orgId, token)
        data = {...organizationAndApps, stores} as FetchResponse
        // We need ALL stores so we can validate the selected one.
        // This is a temporary workaround until we have an endpoint to fetch only 1 store to validate.
      },
    },
  ]
  await renderTasks(tasks)
  return data
}

/**
 * Any data sent via input flags takes precedence and needs to be validated.
 * If any of the inputs is invalid, we must throw an error and stop the execution.
 */
async function fetchDevDataFromOptions(
  options: DevContextOptions,
  orgId: string,
  token: string,
): Promise<{app?: OrganizationApp; store?: OrganizationStore}> {
  const [selectedApp, orgWithStore] = await Promise.all([
    (async () => {
      let selectedApp: OrganizationApp | undefined
      if (options.apiKey) {
        selectedApp = await fetchAppFromApiKey(options.apiKey, token)
        if (!selectedApp) {
          const errorMessage = InvalidApiKeyErrorMessage(options.apiKey)
          throw new AbortError(errorMessage.message, errorMessage.tryMessage)
        }
        return selectedApp
      }
    })(),
    (async () => {
      if (options.storeFqdn) {
        const orgWithStore = await fetchStoreByDomain(orgId, token, options.storeFqdn)
        if (!orgWithStore) throw new BugError(`Could not find Organization for id ${orgId}.`)
        if (!orgWithStore.store) {
          const partners = await partnersFqdn()
          const org = orgWithStore.organization
          throw new BugError(
            `Could not find ${options.storeFqdn} in the Organization ${org.businessName} as a valid store.`,
            `Visit https://${partners}/${org.id}/stores to create a new development or Shopify Plus sandbox store in your organization`,
          )
        }
        return orgWithStore as {store: OrganizationStore; organization: Organization}
      }
    })(),
  ])
  let selectedStore: OrganizationStore | undefined

  if (options.storeFqdn) {
    selectedStore = orgWithStore!.store
    await convertToTestStoreIfNeeded(selectedStore, orgWithStore!.organization.id, token)
  }

  return {app: selectedApp, store: selectedStore}
}

interface AppDevCachedContext {
  configuration: AppConfiguration
  configurationPath: string
  cachedInfo?: CachedAppInfo
  remoteApp?: OrganizationApp
}

/**
 * Retrieve app info from the cache or the current configuration.
 * @param reset - Whether to reset the cache or not.
 * @param directory - The directory containing the app.
 * @param token - The partners token.
 */
async function getAppDevCachedContext({
  reset,
  directory,
  token,
  config,
}: {
  reset: boolean
  directory: string
  token: string
  config?: string
}): Promise<AppDevCachedContext> {
  if (reset) clearAppInfo(directory)

  let cachedInfo = getAppInfo(directory)

  const {configuration, configurationPath} = await loadAppConfiguration({
    directory,
    configName: config || cachedInfo?.configFile,
  })

  let remoteApp
  if (isCurrentAppSchema(configuration)) {
    remoteApp = await appFromId(configuration.client_id, token)
    cachedInfo = {
      ...cachedInfo,
      directory,
      configFile: basename(configurationPath),
      orgId: remoteApp.organizationId,
      appId: remoteApp.apiKey,
      title: remoteApp.title,
      storeFqdn: configuration.cli?.dev_store_url,
      updateURLs: configuration.cli?.automatically_update_urls_on_dev,
    }
  }

  return {
    configuration,
    configurationPath,
    cachedInfo,
    remoteApp,
  }
}

/**
 * Fetch all orgs the user belongs to and show a prompt to select one of them
 * @param token - Token to access partners API
 * @returns The selected organization ID
 */
async function selectOrg(token: string): Promise<string> {
  const orgs = await fetchOrganizations(token)
  const org = await selectOrganizationPrompt(orgs)
  return org.id
}

interface ReusedValuesOptions {
  directory: string
  organization: Organization
  selectedApp: OrganizationApp
  selectedStore: OrganizationStore
  cachedInfo?: CachedAppInfo
}

/**
 * Message shown to the user in case we are reusing a previous configuration
 */
async function showDevReusedValues({
  directory,
  organization,
  selectedApp,
  selectedStore,
  cachedInfo,
}: ReusedValuesOptions) {
  if (!cachedInfo) return

  const usingDifferentSettings =
    selectedApp.apiKey !== cachedInfo?.appId || selectedStore.shopDomain !== cachedInfo.storeFqdn
  if (!cachedInfo?.configFile && usingDifferentSettings) return

  let updateURLs = 'Not yet configured'
  if (cachedInfo.updateURLs !== undefined) updateURLs = cachedInfo.updateURLs ? 'Always' : 'Never'

  const items = [
    `Org:          ${organization.businessName}`,
    `App:          ${cachedInfo.title}`,
    `Dev store:    ${cachedInfo.storeFqdn}`,
    `Update URLs:  ${updateURLs}`,
  ]

  if (cachedInfo.tunnelPlugin) {
    items.push(`Tunnel:       ${cachedInfo.tunnelPlugin}`)
  }

  const packageManager = await getPackageManager(directory)
  renderInfo({
    headline: reusedValuesTableTitle(cachedInfo),
    body: [
      {
        list: {
          items,
        },
      },
      '\nTo reset your default dev config, run',
      {command: formatPackageManagerCommand(packageManager, 'dev', '--reset')},
    ],
  })
}

function showGenerateReusedValues(org: string, cachedAppInfo: CachedAppInfo, packageManager: PackageManager) {
  renderInfo({
    headline: reusedValuesTableTitle(cachedAppInfo),
    body: [
      {
        list: {
          items: [`Org:          ${org}`, `App:          ${cachedAppInfo.title}`],
        },
      },
      '\nTo reset your default dev config, run',
      {command: formatPackageManagerCommand(packageManager, 'dev', '--reset')},
    ],
  })
}

function reusedValuesTableTitle(cachedInfo: CachedAppInfo) {
  return cachedInfo.configFile
    ? `Using ${getAppConfigurationFileName(cachedInfo.configFile)}:`
    : 'Using these settings:'
}

/**
 * Message shown to the user in case we are reusing a previous configuration
 * @param org - Organization name
 * @param app - App name
 * @param store - Store domain
 */
function showDevValues(org: string, appName: string) {
  renderInfo({
    headline: 'Your configs for dev were:',
    body: {
      list: {
        items: [`Org:        ${org}`, `App:        ${appName}`],
      },
    },
  })
}

async function logMetadataForLoadedDevContext(env: DevContextOutput) {
  await metadata.addPublicMetadata(() => ({
    partner_id: tryParseInt(env.remoteApp.organizationId),
    api_key: env.remoteApp.apiKey,
  }))
}

async function logMetadataForLoadedDeployContext(env: DeployContextOutput) {
  await metadata.addPublicMetadata(() => ({
    partner_id: tryParseInt(env.partnersApp.organizationId),
    api_key: env.identifiers.app,
  }))
}

export async function enableDeveloperPreview(app: OrganizationApp, token: string) {
  return developerPreviewUpdate(app, token, true)
}

export async function disableDeveloperPreview(app: OrganizationApp, token: string) {
  return developerPreviewUpdate(app, token, false)
}

async function developerPreviewUpdate(app: OrganizationApp, token: string, enabled: boolean) {
  if (!app.betas?.unifiedAppDeployment) return

  const tasks = [
    {
      title: `${enabled ? 'Enabling' : 'Disabling'} developer preview...`,
      task: async () => {
        let result: DevelopmentStorePreviewUpdateSchema | undefined
        let error: string | undefined
        try {
          const query = DevelopmentStorePreviewUpdateQuery
          const variables: DevelopmentStorePreviewUpdateInput = {
            input: {
              apiKey: app.apiKey,
              enabled,
            },
          }
          result = await partnersRequest(query, token, variables)
          // eslint-disable-next-line no-catch-all/no-catch-all, @typescript-eslint/no-explicit-any
        } catch (err: any) {
          error = err.message
        }

        if ((result && result.developmentStorePreviewUpdate.userErrors?.length > 0) || error) {
          const previewURL = outputToken.link(
            'Partner Dashboard',
            await devPreviewURL({orgId: app.organizationId, appId: app.id}),
          )
          outputWarn(
            outputContent`Unable to ${
              enabled ? 'enable' : 'disable'
            } development store preview for this app. You can change this setting in the ${previewURL}.'}`,
          )
        } else {
          outputCompleted(`Development store preview ${enabled ? 'enabled' : 'disabled'}`)
        }
      },
    },
  ]
  await renderTasks(tasks)
  outputNewline()
}

async function logMetadataForLoadedReleaseContext(env: ReleaseContextOutput, partnerId: string) {
  await metadata.addPublicMetadata(() => ({
    partner_id: tryParseInt(partnerId),
    api_key: env.apiKey,
  }))
}

async function devPreviewURL(options: {orgId: string; appId: string}) {
  const fqdn = await partnersFqdn()
  return `https://${fqdn}/${options.orgId}/apps/${options.appId}/extensions`
}
