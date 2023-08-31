import {selectOrCreateApp} from './dev/select-app.js'
import {
  fetchAllDevStores,
  fetchAppDetailsFromApiKey,
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
import {CachedAppInfo, clearCachedAppInfo, getCachedAppInfo, setCachedAppInfo} from './local-storage.js'
import {DeploymentMode, resolveDeploymentMode} from './deploy/mode.js'
import link from './app/config/link.js'
import {writeAppConfigurationFile} from './app/write-app-configuration-file.js'
import {reuseDevConfigPrompt, selectOrganizationPrompt} from '../prompts/dev.js'
import {
  AppConfiguration,
  AppInterface,
  isCurrentAppSchema,
  appIsLaunchable,
  getAppScopesArray,
} from '../models/app/app.js'
import {Identifiers, UuidOnlyIdentifiers, updateAppIdentifiers, getAppIdentifiers} from '../models/app/identifiers.js'
import {Organization, OrganizationApp, OrganizationStore} from '../models/organization.js'
import metadata from '../metadata.js'
import {getAppConfigurationFileName, loadAppConfiguration, loadAppName} from '../models/app/loader.js'
import {ExtensionInstance} from '../models/extensions/extension-instance.js'

import {ExtensionRegistration} from '../api/graphql/all_app_extension_registrations.js'
import {
  DevelopmentStorePreviewUpdateInput,
  DevelopmentStorePreviewUpdateQuery,
  DevelopmentStorePreviewUpdateSchema,
} from '../api/graphql/development_preview.js'
import {tryParseInt} from '@shopify/cli-kit/common/string'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {TokenItem, renderError, renderInfo, renderTasks} from '@shopify/cli-kit/node/ui'
import {partnersFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError, AbortSilentError, BugError} from '@shopify/cli-kit/node/error'
import {outputContent} from '@shopify/cli-kit/node/output'
import {getOrganization} from '@shopify/cli-kit/node/environment'
import {basename, joinPath} from '@shopify/cli-kit/node/path'
import {Config} from '@oclif/core'
import {glob} from '@shopify/cli-kit/node/fs'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'

export const InvalidApiKeyErrorMessage = (apiKey: string) => {
  return {
    message: outputContent`Invalid Client ID: ${apiKey}`,
    tryMessage: outputContent`You can find the Client ID in the app settings in the Partners Dashboard.`,
  }
}

export interface DevContextOptions {
  directory: string
  apiKey?: string
  configName?: string
  storeFqdn?: string
  reset: boolean
  commandConfig: Config
}

interface DevContextOutput {
  remoteApp: Omit<OrganizationApp, 'apiSecretKeys'> & {apiSecret?: string}
  remoteAppUpdated: boolean
  storeFqdn: string
  updateURLs: boolean | undefined
  configName?: string
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
  commandConfig: Config
  configName?: string
}): Promise<string> {
  if (options.apiKey) {
    const app = await fetchAppDetailsFromApiKey(options.apiKey, options.token)
    if (!app) {
      const errorMessage = InvalidApiKeyErrorMessage(options.apiKey)
      throw new AbortError(errorMessage.message, errorMessage.tryMessage)
    }
    return app.apiKey
  }

  const {cachedInfo, remoteApp} = await getAppContext(options)

  if (cachedInfo?.appId && cachedInfo?.orgId) {
    const org = await fetchOrgFromId(cachedInfo.orgId, options.token)
    const app = remoteApp || (await fetchAppDetailsFromApiKey(cachedInfo.appId, options.token))
    if (!app || !org) {
      const errorMessage = InvalidApiKeyErrorMessage(cachedInfo.appId)
      throw new AbortError(errorMessage.message, errorMessage.tryMessage)
    }
    showReusedGenerateValues(org.businessName, cachedInfo)
    return app.apiKey
  } else {
    const orgId = cachedInfo?.orgId || (await selectOrg(options.token))
    const {organization, apps} = await fetchOrgAndApps(orgId, options.token)
    const localAppName = await loadAppName(options.directory)
    const selectedApp = await selectOrCreateApp(localAppName, apps, organization, options.token)
    setCachedAppInfo({
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
  const {configuration, cachedInfo, remoteApp} = await getAppContext({
    ...options,
    token,
    promptLinkingApp: !options.apiKey,
  })

  const orgId = getOrganization() || cachedInfo?.orgId || (await selectOrg(token))

  let {app: selectedApp, store: selectedStore} = await fetchDevDataFromOptions(options, orgId, token)
  const organization = await fetchOrgFromId(orgId, token)

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
      // get toml names somewhere close to here
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

  // We only update the cache or config if the current app is the right one
  const rightApp = selectedApp.apiKey === cachedInfo?.appId
  if (isCurrentAppSchema(configuration) && rightApp) {
    if (cachedInfo) cachedInfo.storeFqdn = selectedStore?.shopDomain
    const newConfiguration: AppConfiguration = {
      ...configuration,
      build: {
        ...configuration.build,
        dev_store_url: selectedStore?.shopDomain,
      },
    }
    await writeAppConfigurationFile(newConfiguration)
  } else if (!cachedInfo || rightApp) {
    setCachedAppInfo({
      appId: selectedApp.apiKey,
      title: selectedApp.title,
      directory: options.directory,
      storeFqdn: selectedStore?.shopDomain,
      orgId,
    })
  }

  await showReusedDevValues({
    selectedApp,
    selectedStore,
    cachedInfo,
    organization,
  })

  const result = buildOutput(selectedApp, selectedStore, cachedInfo)
  await logMetadataForLoadedDevContext(result)
  return result
}

const resetHelpMessage = ['You can pass', {command: '--reset'}, 'to your command to reset your app configuration.']

const appFromId = async (appId: string, token: string): Promise<OrganizationApp> => {
  const app = await fetchAppDetailsFromApiKey(appId, token)
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

function buildOutput(app: OrganizationApp, store: OrganizationStore, cachedInfo?: CachedAppInfo): DevContextOutput {
  return {
    remoteApp: {
      ...app,
      apiSecret: app.apiSecretKeys.length === 0 ? undefined : app.apiSecretKeys[0]!.secret,
    },
    remoteAppUpdated: app.apiKey !== cachedInfo?.previousAppId,
    storeFqdn: store.shopDomain,
    updateURLs: cachedInfo?.updateURLs,
    configName: cachedInfo?.configFile,
  }
}

export interface ReleaseContextOptions {
  app: AppInterface
  apiKey?: string
  reset: boolean
  force: boolean
  commandConfig: Config
}

interface ReleaseContextOutput {
  token: string
  app: AppInterface
  partnersApp: OrganizationApp
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
  const devAppId = getCachedAppInfo(app.directory)?.appId
  if (!devAppId) return undefined

  const partnersResponse = await fetchAppDetailsFromApiKey(devAppId, token)
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

export interface DeployContextOptions {
  app: AppInterface
  apiKey?: string
  reset: boolean
  force: boolean
  noRelease: boolean
  commitReference?: string
  commandConfig: Config
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

  const org = await fetchOrgFromId(partnersApp.organizationId, token)
  showReusedDeployValues(org.businessName, options.app, partnersApp)

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
 * If the app doesn't have the simplified deployments beta enabled, throw an error.
 * Finally, the info is updated in the env file.
 *
 * @param options - Current dev context options
 * @returns The selected org, app and dev store
 */
export async function ensureReleaseContext(options: ReleaseContextOptions): Promise<ReleaseContextOutput> {
  const token = await ensureAuthenticatedPartners()
  const [partnersApp, envIdentifiers] = await fetchAppAndIdentifiers(options, token)
  const identifiers: Identifiers = envIdentifiers as Identifiers
  checkDeploymentsBeta('release', partnersApp)

  // eslint-disable-next-line no-param-reassign
  options = {
    ...options,
    app: await updateAppIdentifiers({app: options.app, identifiers, command: 'release'}),
  }
  const result = {
    app: options.app,
    apiKey: partnersApp.apiKey,
    partnersApp,
    token,
  }

  await logMetadataForLoadedReleaseContext(result, partnersApp.organizationId)
  return result
}

interface VersionListContextOptions {
  app: AppInterface
  apiKey?: string
  reset: false
  commandConfig: Config
}

interface VersionsListContextOutput {
  token: string
  partnersApp: OrganizationApp
}

/**
 * Make sure there is a valid context to execute `versions list`
 * That means we have a valid session, organization and app with the simplified deployments beta enabled.
 *
 * If there is an API key via flag, configuration or env file, we check if it is valid. Otherwise, throw an error.
 * If there is no API key (or is invalid), show prompts to select an org and app.
 * If the app doesn't have the simplified deployments beta enabled, throw an error.
 *
 * @param options - Current dev context options
 * @returns The partners token and app
 */
export async function ensureVersionsListContext(
  options: VersionListContextOptions,
): Promise<VersionsListContextOutput> {
  const token = await ensureAuthenticatedPartners()
  const [partnersApp] = await fetchAppAndIdentifiers(options, token)
  checkDeploymentsBeta('versions list', partnersApp)

  return {
    token,
    partnersApp,
  }
}

export async function fetchOrCreateOrganizationApp(
  app: AppInterface,
  token: string,
  directory?: string,
): Promise<OrganizationApp> {
  const orgId = await selectOrg(token)
  const {organization, apps} = await fetchOrgsAppsAndStores(orgId, token)
  const isLaunchable = appIsLaunchable(app)
  const scopesArray = getAppScopesArray(app.configuration)
  const partnersApp = await selectOrCreateApp(app.name, apps, organization, token, {
    isLaunchable,
    scopesArray,
    directory,
  })
  return partnersApp
}

export async function fetchAppAndIdentifiers(
  options: {
    app: AppInterface
    reset: boolean
    apiKey?: string
    commandConfig: Config
  },
  token: string,
  reuseFromDev = true,
): Promise<[OrganizationApp, Partial<UuidOnlyIdentifiers>]> {
  const app = options.app
  let reuseDevCache = reuseFromDev
  let envIdentifiers = getAppIdentifiers({app})
  let partnersApp: OrganizationApp | undefined

  if (options.reset) {
    envIdentifiers = {app: undefined, extensions: {}}
    reuseDevCache = false
    if (isCurrentAppSchema(app.configuration)) {
      const configuration = await link({directory: app.directory, commandConfig: options.commandConfig})
      app.configuration = configuration
    }
  }

  if (isCurrentAppSchema(app.configuration)) {
    const apiKey = options.apiKey ?? app.configuration.client_id
    partnersApp = await appFromId(apiKey, token)
  } else if (options.apiKey) {
    partnersApp = await appFromId(options.apiKey, token)
  } else if (envIdentifiers.app) {
    partnersApp = await appFromId(envIdentifiers.app, token)
  } else if (reuseDevCache) {
    partnersApp = await fetchDevAppAndPrompt(app, token)
  }

  if (!partnersApp) {
    partnersApp = await fetchOrCreateOrganizationApp(app, token)
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
        selectedApp = await fetchAppDetailsFromApiKey(options.apiKey, token)
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

export interface AppContext {
  configuration: AppConfiguration
  cachedInfo?: CachedAppInfo
  remoteApp?: OrganizationApp
}

/**
 * Retrieve app info from the cache or the current configuration.
 *
 * @param reset - Whether to reset the cache or not.
 * @param directory - The directory containing the app.
 * @param token - The partners token.
 */
export async function getAppContext({
  reset,
  directory,
  token,
  configName,
  commandConfig,
  promptLinkingApp = true,
}: {
  reset: boolean
  directory: string
  token: string
  configName?: string
  commandConfig?: Config
  promptLinkingApp?: boolean
}): Promise<AppContext> {
  const previousCachedInfo = getCachedAppInfo(directory)

  if (reset) clearCachedAppInfo(directory)

  const firstTimeSetup = previousCachedInfo === undefined
  const usingConfigAndResetting = previousCachedInfo?.configFile && reset
  const usingConfigWithNoTomls =
    previousCachedInfo?.configFile && (await glob(joinPath(directory, 'shopify.app*.toml'))).length === 0

  if (promptLinkingApp && commandConfig && (firstTimeSetup || usingConfigAndResetting || usingConfigWithNoTomls)) {
    await link({directory, commandConfig}, false)
  }

  let cachedInfo = getCachedAppInfo(directory)

  const {configuration} = await loadAppConfiguration({
    directory,
    configName,
  })

  let remoteApp
  if (isCurrentAppSchema(configuration)) {
    remoteApp = await appFromId(configuration.client_id, token)
    cachedInfo = {
      ...cachedInfo,
      directory,
      configFile: basename(configuration.path),
      orgId: remoteApp.organizationId,
      appId: remoteApp.apiKey,
      title: remoteApp.title,
      storeFqdn: configuration.build?.dev_store_url,
      updateURLs: configuration.build?.automatically_update_urls_on_dev,
    }
  }

  return {
    configuration,
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
  organization: Organization
  selectedApp: OrganizationApp
  selectedStore: OrganizationStore
  cachedInfo?: CachedAppInfo
}

/**
 * Message shown to the user in case we are reusing a previous configuration
 */
function showReusedDevValues({organization, selectedApp, selectedStore, cachedInfo}: ReusedValuesOptions) {
  if (!cachedInfo) return

  const usingDifferentSettings =
    selectedApp.apiKey !== cachedInfo?.appId || selectedStore.shopDomain !== cachedInfo.storeFqdn
  const configFileName = usingDifferentSettings ? undefined : cachedInfo.configFile

  let updateURLs = 'Not yet configured'
  if (cachedInfo.updateURLs !== undefined) updateURLs = cachedInfo.updateURLs ? 'Yes' : 'No'

  renderCurrentlyUsedConfigInfo({
    org: organization.businessName,
    appName: selectedApp.title,
    devStore: selectedStore.shopDomain,
    updateURLs,
    configFile: cachedInfo.configFile,
    resetMessage: resetHelpMessage,
  })
}

interface CurrentlyUsedConfigInfoOptions {
  org: string
  appName: string
  devStore?: string
  updateURLs?: string
  configFile?: string
  appDotEnv?: string
  resetMessage?: (
    | string
    | {
        command: string
      }
  )[]
}

export function renderCurrentlyUsedConfigInfo({
  org,
  appName,
  devStore,
  updateURLs,
  configFile,
  appDotEnv,
  resetMessage,
}: CurrentlyUsedConfigInfoOptions): void {
  const items = [`Org:          ${org}`, `App:          ${appName}`]

  if (devStore) items.push(`Dev store:    ${devStore}`)
  if (updateURLs) items.push(`Update URLs:  ${updateURLs}`)

  let body: TokenItem = [{list: {items}}]
  if (resetMessage) body = [...body, '\n', ...resetMessage]

  const fileName = (appDotEnv && basename(appDotEnv)) || (configFile && getAppConfigurationFileName(configFile))

  renderInfo({
    headline: configFile ? `Using ${fileName}:` : 'Using these settings:',
    body,
  })
}

export function showReusedGenerateValues(org: string, cachedAppInfo: CachedAppInfo) {
  renderCurrentlyUsedConfigInfo({
    org,
    appName: cachedAppInfo.title!,
    configFile: cachedAppInfo.configFile,
    resetMessage: resetHelpMessage,
  })
}

export function showReusedDeployValues(
  org: string,
  app: AppInterface,
  remoteApp: Omit<OrganizationApp, 'apiSecretKeys' | 'apiKey'>,
) {
  renderCurrentlyUsedConfigInfo({
    org,
    appName: remoteApp.title,
    appDotEnv: app.dotenv?.path,
    configFile: isCurrentAppSchema(app.configuration) ? basename(app.configuration.path) : undefined,
    resetMessage: resetHelpMessage,
  })
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

export async function enableDeveloperPreview({apiKey, token}: {apiKey: string; token: string}) {
  return developerPreviewUpdate({apiKey, token, enabled: true})
}

export async function disableDeveloperPreview({apiKey, token}: {apiKey: string; token: string}) {
  await developerPreviewUpdate({apiKey, token, enabled: false})
}

export async function developerPreviewUpdate({
  apiKey,
  token,
  enabled,
}: {
  apiKey: string
  token: string
  enabled: boolean
}) {
  let result: DevelopmentStorePreviewUpdateSchema | undefined
  try {
    const query = DevelopmentStorePreviewUpdateQuery
    const variables: DevelopmentStorePreviewUpdateInput = {
      input: {
        apiKey,
        enabled,
      },
    }

    result = await partnersRequest(query, token, variables)
    const userErrors = result?.developmentStorePreviewUpdate?.userErrors
    return !userErrors || userErrors.length === 0

    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error: unknown) {
    return false
  }
}

async function logMetadataForLoadedReleaseContext(env: ReleaseContextOutput, partnerId: string) {
  await metadata.addPublicMetadata(() => ({
    partner_id: tryParseInt(partnerId),
    api_key: env.partnersApp.apiKey,
  }))
}

function checkDeploymentsBeta(command: string, partnersApp: OrganizationApp) {
  const deploymentMode: DeploymentMode = partnersApp.betas?.unifiedAppDeployment ? 'unified' : 'legacy'
  if (deploymentMode === 'legacy') {
    renderError({
      headline: `The \`app ${command}\` command is only available for apps that have upgraded to use simplified deployment.`,
      reference: [
        {
          link: {
            label: 'Simplified extension deployment',
            url: 'https://shopify.dev/docs/apps/deployment/extension',
          },
        },
      ],
    })
    throw new AbortSilentError()
  }
}
