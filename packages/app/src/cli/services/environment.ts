import {selectOrCreateApp} from './dev/select-app.js'
import {
  fetchAllStores,
  fetchAppFromApiKey,
  fetchOrgAndApps,
  fetchOrganizations,
  fetchOrgFromId,
  fetchStoreByDomain,
  FetchResponse,
} from './dev/fetch.js'
import {convertToTestStoreIfNeeded, selectStore} from './dev/select-store.js'
import {ensureDeploymentIdsPresence} from './environment/identifiers.js'
import {reuseDevConfigPrompt, selectOrganizationPrompt} from '../prompts/dev.js'
import {AppInterface} from '../models/app/app.js'
import {Identifiers, UuidOnlyIdentifiers, updateAppIdentifiers, getAppIdentifiers} from '../models/app/identifiers.js'
import {Organization, OrganizationApp, OrganizationStore} from '../models/organization.js'
import metadata from '../metadata.js'
import {error as kitError, output, session, store, ui, environment, error, string} from '@shopify/cli-kit'
import {PackageManager} from '@shopify/cli-kit/node/node-package-manager'

export const InvalidApiKeyError = (apiKey: string) => {
  return new kitError.Abort(
    output.content`Invalid API key: ${apiKey}`,
    output.content`You can find the API key in the app settings in the Partner Dashboard.`,
  )
}

export const DeployAppNotFound = (apiKey: string, packageManager: PackageManager) => {
  return new kitError.Abort(
    output.content`Couldn't find the app with API key ${apiKey}`,
    output.content`• If you didn't intend to select this app, run ${
      output.content`${output.token.packagejsonScript(packageManager, 'deploy', '--reset')}`.value
    }`,
  )
}

export const AppOrganizationNotFoundError = (apiKey: string, organizations: string[]) => {
  return new kitError.Abort(
    `The application with API Key ${apiKey} doesn't belong to any of your organizations: ${organizations.join(', ')}`,
  )
}

const OrganizationNotFoundError = (orgId: string) => {
  return new error.Bug(`Could not find Organization for id ${orgId}.`)
}

const StoreNotFoundError = (storeName: string, org: Organization) => {
  return new error.Bug(
    `Could not find ${storeName} in the Organization ${org.businessName} as a valid development store.`,
    `Visit https://partners.shopify.com/${org.id}/stores to create a new store in your organization`,
  )
}

export interface DevEnvironmentOptions {
  app: AppInterface
  apiKey?: string
  storeFqdn?: string
  reset: boolean
}

interface DevEnvironmentOutput {
  app: Omit<OrganizationApp, 'apiSecretKeys' | 'apiKey'> & {apiSecret?: string}
  storeFqdn: string
  identifiers: UuidOnlyIdentifiers
}

/**
 * Make sure there is a valid environment to execute `dev`
 * That means we have a valid organization, app and dev store selected.
 *
 * If there are app/store from flags, we check if they are valid. If they are not, throw an error.
 * If there is cached info (user ran `dev` previously), check if it is still valid and return it.
 * If there is no cached info (or is invalid):
 *  - Show prompts to select an org, app and dev store
 *  - The new selection will be saved as global configuration
 *  - The `shopify.app.toml` file will be updated with the new app apiKey
 *
 * @param options {DevEnvironmentInput} Current dev environment options
 * @returns {Promise<DevEnvironmentOutput>} The selected org, app and dev store
 */
export async function ensureDevEnvironment(
  options: DevEnvironmentOptions,
  token: string,
): Promise<DevEnvironmentOutput> {
  const prodEnvIdentifiers = await getAppIdentifiers({app: options.app})
  const envExtensionsIds = prodEnvIdentifiers.extensions || {}

  const cachedInfo = getAppDevCachedInfo({
    reset: options.reset,
    directory: options.app.directory,
    apiKey: options.apiKey ?? store.cliKitStore().getAppInfo(options.app.directory)?.appId,
  })

  const explanation =
    `\nLooks like this is the first time you're running dev for this project.\n` +
    'Configure your preferences by answering a few questions.\n'

  if (cachedInfo === undefined && !options.reset) {
    output.info(explanation)
  }

  const orgId = cachedInfo?.orgId || (await selectOrg(token))

  let {app: selectedApp, store: selectedStore} = await fetchDevDataFromOptions(options, orgId, token)
  if (selectedApp && selectedStore) {
    // eslint-disable-next-line no-param-reassign
    options = await updateDevOptions({...options, apiKey: selectedApp.apiKey})

    store.cliKitStore().setAppInfo({
      appId: selectedApp.apiKey,
      directory: options.app.directory,
      storeFqdn: selectedStore.shopDomain,
      orgId,
    })

    // If the selected app is the "prod" one, we will use the real extension IDs for `dev`
    const extensions = prodEnvIdentifiers.app === selectedApp.apiKey ? envExtensionsIds : {}
    return {
      app: {
        ...selectedApp,
        apiSecret: selectedApp.apiSecretKeys.length === 0 ? undefined : selectedApp.apiSecretKeys[0].secret,
      },
      storeFqdn: selectedStore.shopDomain,
      identifiers: {
        app: selectedApp.apiKey,
        extensions,
      },
    }
  }

  const {organization, apps} = await fetchOrgAndApps(orgId, token)
  selectedApp = selectedApp || (await selectOrCreateApp(options.app, apps, organization, token, cachedInfo?.appId))
  store
    .cliKitStore()
    .setAppInfo({appId: selectedApp.apiKey, title: selectedApp.title, directory: options.app.directory, orgId})

  // eslint-disable-next-line no-param-reassign
  options = await updateDevOptions({...options, apiKey: selectedApp.apiKey})
  if (!selectedStore) {
    const allStores = await fetchAllStores(orgId, token)
    selectedStore = await selectStore(allStores, organization, token, cachedInfo?.storeFqdn)
  }

  store
    .cliKitStore()
    .setAppInfo({appId: selectedApp.apiKey, directory: options.app.directory, storeFqdn: selectedStore?.shopDomain})

  if (selectedApp.apiKey === cachedInfo?.appId && selectedStore.shopDomain === cachedInfo.storeFqdn) {
    showReusedValues(organization.businessName, selectedApp.title, selectedStore.shopDomain, options.app.packageManager)
  }

  const extensions = prodEnvIdentifiers.app === selectedApp.apiKey ? envExtensionsIds : {}
  const result = {
    app: {
      ...selectedApp,
      apiSecret: selectedApp.apiSecretKeys.length === 0 ? undefined : selectedApp.apiSecretKeys[0].secret,
    },
    storeFqdn: selectedStore.shopDomain,
    identifiers: {
      app: selectedApp.apiKey,
      extensions,
    },
  }
  await logMetadataForLoadedDevEnvironment(result)
  return result
}

async function updateDevOptions(options: DevEnvironmentOptions & {apiKey: string}) {
  const updatedApp = await updateAppIdentifiers({
    app: options.app,
    identifiers: {
      app: options.apiKey,
      extensions: {},
    },
    command: 'dev',
  })
  return {
    ...options,
    app: updatedApp,
  }
}

export interface DeployEnvironmentOptions {
  app: AppInterface
  reset: boolean
}

interface DeployEnvironmentOutput {
  app: AppInterface
  token: string
  partnersOrganizationId: string
  partnersApp: Omit<OrganizationApp, 'apiSecretKeys' | 'apiKey'>
  identifiers: Identifiers
}

/**
 * If there is a cached ApiKey used for dev, retrieve that and ask the user if they want to reuse it
 * @param app {AppInterface} The local app object
 * @param token {string} The token to use to access the Partners API
 * @returns {Promise<OrganizationApp | undefined>}
 * OrganizationApp if a cached value is valid.
 * undefined if there is no cached value or the user doesn't want to use it.
 */
async function fetchDevAppAndPrompt(app: AppInterface, token: string): Promise<OrganizationApp | undefined> {
  const devAppId = store.cliKitStore().getAppInfo(app.directory)?.appId
  if (!devAppId) return undefined

  const partnersResponse = await fetchAppFromApiKey(devAppId, token)
  if (!partnersResponse) return undefined

  const org: Organization | undefined = await fetchOrgFromId(partnersResponse.organizationId, token)

  showDevValues(org?.businessName ?? 'unknown', partnersResponse.title)
  const reuse = await reuseDevConfigPrompt()
  return reuse ? partnersResponse : undefined
}

export async function ensureDeployEnvironment(options: DeployEnvironmentOptions): Promise<DeployEnvironmentOutput> {
  const token = await session.ensureAuthenticatedPartners()
  let envIdentifiers = await getAppIdentifiers({app: options.app})

  let partnersApp: OrganizationApp | undefined

  if (options.reset) {
    envIdentifiers = {app: undefined, extensions: {}}
  } else if (envIdentifiers.app) {
    partnersApp = await fetchAppFromApiKey(envIdentifiers.app, token)
    if (!partnersApp) throw DeployAppNotFound(envIdentifiers.app, options.app.packageManager)
  } else {
    partnersApp = await fetchDevAppAndPrompt(options.app, token)
  }

  let identifiers: Identifiers = envIdentifiers as Identifiers

  if (!partnersApp) {
    const result = await fetchOrganizationAndFetchOrCreateApp(options.app, token)
    partnersApp = result.partnersApp
  }

  identifiers = await ensureDeploymentIdsPresence({
    app: options.app,
    appId: partnersApp.apiKey,
    appName: partnersApp.title,
    token,
    envIdentifiers,
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
    },
    partnersOrganizationId: partnersApp.organizationId,
    identifiers,
    token,
  }

  await logMetadataForLoadedDeployEnvironment(result)
  return result
}

async function fetchOrganizationAndFetchOrCreateApp(
  app: AppInterface,
  token: string,
): Promise<{partnersApp: OrganizationApp; orgId: string}> {
  const orgId = await selectOrg(token)
  const {organization, apps} = await fetchOrgsAppsAndStores(orgId, token)
  const partnersApp = await selectOrCreateApp(app, apps, organization, token, undefined)
  return {orgId, partnersApp}
}

async function fetchOrgsAppsAndStores(orgId: string, token: string): Promise<FetchResponse> {
  let data = {} as FetchResponse
  const list = ui.newListr(
    [
      {
        title: 'Fetching organization data',
        task: async () => {
          const organizationAndApps = await fetchOrgAndApps(orgId, token)
          const stores = await fetchAllStores(orgId, token)
          data = {...organizationAndApps, stores} as FetchResponse
          // We need ALL stores so we can validate the selected one.
          // This is a temporary workaround until we have an endpoint to fetch only 1 store to validate.
        },
      },
    ],
    {rendererSilent: environment.local.isUnitTest()},
  )
  await list.run()
  return data
}

/**
 * Any data sent via input flags takes precedence and needs to be validated.
 * If any of the inputs is invalid, we must throw an error and stop the execution.
 * @param input
 * @returns
 */
async function fetchDevDataFromOptions(
  options: DevEnvironmentOptions,
  orgId: string,
  token: string,
): Promise<{app?: OrganizationApp; store?: OrganizationStore}> {
  let selectedApp: OrganizationApp | undefined
  let selectedStore: OrganizationStore | undefined

  if (options.apiKey) {
    selectedApp = await fetchAppFromApiKey(options.apiKey, token)
    if (!selectedApp) throw InvalidApiKeyError(options.apiKey)
  }

  if (options.storeFqdn) {
    const orgWithStore = await fetchStoreByDomain(orgId, token, options.storeFqdn)
    if (!orgWithStore) throw OrganizationNotFoundError(orgId)
    if (!orgWithStore.store) throw StoreNotFoundError(options.storeFqdn, orgWithStore?.organization)
    await convertToTestStoreIfNeeded(orgWithStore.store, orgWithStore.organization, token)
    selectedStore = orgWithStore.store
  }

  return {app: selectedApp, store: selectedStore}
}

/**
 * Retrieve cached info from the global configuration based on the current local app
 * @param reset {boolean} Whether to reset the cache or not
 * @param directory {string} The directory containing the app.
 * @param appId {string} Current local app id, used to retrieve the cached info
 * @returns
 */
function getAppDevCachedInfo({
  reset,
  directory,
  apiKey,
}: {
  reset: boolean
  directory: string
  apiKey?: string
}): store.CachedAppInfo | undefined {
  if (!apiKey) return undefined
  if (apiKey && reset) store.cliKitStore().clearAppInfo(directory)
  return store.cliKitStore().getAppInfo(directory)
}

/**
 * Fetch all orgs the user belongs to and show a prompt to select one of them
 * @param token {string} Token to access partners API
 * @returns {Promise<string>} The selected organization ID
 */
async function selectOrg(token: string): Promise<string> {
  const orgs = await fetchOrganizations(token)
  const org = await selectOrganizationPrompt(orgs)
  return org.id
}

/**
 * Message shown to the user in case we are reusing a previous configuration
 * @param org {string} Organization name
 * @param app {string} App name
 * @param store {string} Store domain
 */
function showReusedValues(org: string, appName: string, store: string, packageManager: PackageManager): void {
  output.info('\nUsing your previous dev settings:')
  output.info(`Org:        ${org}`)
  output.info(`App:        ${appName}`)
  output.info(`Dev store:  ${store}\n`)
  output.info(
    output.content`To reset your default dev config, run ${output.token.packagejsonScript(
      packageManager,
      'dev',
      '--reset',
    )}\n`,
  )
}

/**
 * Message shown to the user in case we are reusing a previous configuration
 * @param org {string} Organization name
 * @param app {string} App name
 * @param store {string} Store domain
 */
function showDevValues(org: string, appName: string) {
  output.info('\nYour configs for dev were:')
  output.info(`Org:        ${org}`)
  output.info(`App:        ${appName}\n`)
}

async function logMetadataForLoadedDevEnvironment(env: DevEnvironmentOutput) {
  metadata.addPublic({partner_id: string.tryParseInt(env.app.organizationId), api_key: env.identifiers.app})
}

async function logMetadataForLoadedDeployEnvironment(env: DeployEnvironmentOutput) {
  metadata.addPublic({partner_id: string.tryParseInt(env.partnersOrganizationId), api_key: env.identifiers.app})
}
