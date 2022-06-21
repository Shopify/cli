import {selectOrCreateApp} from './dev/select-app'
import {
  fetchAllStores,
  fetchAppFromApiKey,
  fetchOrgAndApps,
  fetchOrganizations,
  fetchOrgFromId,
  FetchResponse,
} from './dev/fetch'
import {selectStore, convertToTestStoreIfNeeded} from './dev/select-store'
import {ensureDeploymentIdsPresence} from './environment/identifiers'
import {reuseDevConfigPrompt, selectOrganizationPrompt} from '../prompts/dev'
import {App, Identifiers, UuidOnlyIdentifiers, updateAppIdentifiers, getAppIdentifiers} from '../models/app/app'
import {Organization, OrganizationApp, OrganizationStore} from '../models/organization'
import {error as kitError, output, session, store as conf, ui, environment, dependency} from '@shopify/cli-kit'

export const InvalidApiKeyError = (apiKey: string) => {
  return new kitError.Abort(
    output.content`Invalid API key: ${apiKey}`,
    output.content`You can find the API key in the app settings in the Partner Dashboard.`,
  )
}

export const DeployAppNotFound = (apiKey: string, dependencyManager: dependency.DependencyManager) => {
  return new kitError.Abort(
    output.content`Couldn't find the app with API key ${apiKey}`,
    output.content`• If you didn't intend to select this app, run ${
      output.content`${output.token.packagejsonScript(dependencyManager, 'deploy', '--reset')}`.value
    }`,
  )
}

export const AppOrganizationNotFoundError = (apiKey: string, organizations: string[]) => {
  return new kitError.Abort(
    `The application with API Key ${apiKey} doesn't belong to any of your organizations: ${organizations.join(', ')}`,
  )
}

export interface DevEnvironmentOptions {
  app: App
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
export async function ensureDevEnvironment(options: DevEnvironmentOptions): Promise<DevEnvironmentOutput> {
  const token = await session.ensureAuthenticatedPartners()

  // We retrieve the production identifiers to know if the user has selected the prod app for `dev`
  const prodEnvIdentifiers = await getAppIdentifiers({app: options.app, environmentType: 'production'})
  const envExtensionsIds = prodEnvIdentifiers.extensions || {}

  const cachedInfo = getAppDevCachedInfo({
    reset: options.reset,
    directory: options.app.directory,
    apiKey: options.apiKey ?? conf.getAppInfo(options.app.directory)?.appId,
  })

  const explanation =
    `\nLooks like this is the first time you're running dev for this project.\n` +
    'Configure your preferences by answering a few questions.\n'

  if (cachedInfo === undefined && !options.reset) {
    output.info(explanation)
  }

  const orgId = cachedInfo?.orgId || (await selectOrg(token))
  const {organization, apps, stores} = await fetchOrgsAppsAndStores(orgId, token)

  let {app: selectedApp, store: selectedStore} = await fetchDevDataFromOptions(options, organization, stores, token)
  if (selectedApp && selectedStore) {
    // eslint-disable-next-line no-param-reassign
    options = await updateDevOptions({...options, apiKey: selectedApp.apiKey})

    conf.setAppInfo({appId: selectedApp.apiKey, directory: options.app.directory, storeFqdn: selectedStore, orgId})

    // If the selected app is the "prod" one, we will use the real extension IDs for `dev`
    const extensions = prodEnvIdentifiers.app === selectedApp.apiKey ? envExtensionsIds : {}
    return {
      app: {
        ...selectedApp,
        apiSecret: selectedApp.apiSecretKeys.length === 0 ? undefined : selectedApp.apiSecretKeys[0].secret,
      },
      storeFqdn: selectedStore,
      identifiers: {
        app: selectedApp.apiKey,
        extensions,
      },
    }
  }

  selectedApp = selectedApp || (await selectOrCreateApp(options.app, apps, organization, token, cachedInfo?.appId))
  conf.setAppInfo({appId: selectedApp.apiKey, title: selectedApp.title, directory: options.app.directory, orgId})

  // eslint-disable-next-line no-param-reassign
  options = await updateDevOptions({...options, apiKey: selectedApp.apiKey})
  selectedStore = selectedStore || (await selectStore(stores, organization, token, cachedInfo?.storeFqdn))
  conf.setAppInfo({appId: selectedApp.apiKey, directory: options.app.directory, storeFqdn: selectedStore})

  if (selectedApp.apiKey === cachedInfo?.appId && selectedStore === cachedInfo.storeFqdn) {
    showReusedValues(organization.businessName, options.app, selectedStore)
  }

  // If the selected app is the "prod" one, we will use the real extension IDs for `dev`
  const extensions = prodEnvIdentifiers.app === selectedApp.apiKey ? envExtensionsIds : {}
  return {
    app: {
      ...selectedApp,
      apiSecret: selectedApp.apiSecretKeys.length === 0 ? undefined : selectedApp.apiSecretKeys[0].secret,
    },
    storeFqdn: selectedStore,
    identifiers: {
      app: selectedApp.apiKey,
      extensions,
    },
  }
}

async function updateDevOptions(options: DevEnvironmentOptions & {apiKey: string}) {
  const updatedApp = await updateAppIdentifiers({
    app: options.app,
    identifiers: {
      app: options.apiKey,
      extensions: {},
    },
    environmentType: 'development',
  })
  return {
    ...options,
    app: updatedApp,
  }
}

export interface DeployEnvironmentOptions {
  app: App
  reset: boolean
}

interface DeployEnvironmentOutput {
  app: App
  token: string
  partnersOrganizationId: string
  partnersApp: Omit<OrganizationApp, 'apiSecretKeys' | 'apiKey'>
  identifiers: Identifiers
}

/**
 * If there is an ApiKey in the ENV, retrieve that App and return it
 * If not, but there is a cached ApiKey used for dev, retrieve that and ask the user if they want to reuse it
 * if not, return undefined
 * @param app {App} The local app object
 * @param envApiKey {string} The API key saved in the .env
 * @param token {string} The token to use to access the Partners API
 * @returns {Promise<OrganizationApp | undefined | 'not_found'>}
 * OrganizationApp if a cached value is valid.
 * undefined if there is no cached value or the user doesn't want to use it.
 * not_found if there is cached value but is not found in the API
 */
async function getCachedApp(
  app: App,
  envApiKey: string | undefined,
  token: string,
): Promise<OrganizationApp | undefined | 'not_found'> {
  if (envApiKey) {
    const response = await fetchAppFromApiKey(envApiKey, token)
    return response ?? 'not_found'
  }

  const devAppId = conf.getAppInfo(app.directory)?.appId
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
  let envIdentifiers = await getAppIdentifiers({app: options.app, environmentType: 'production'})
  let identifiers: Identifiers = envIdentifiers as Identifiers

  let partnersApp: OrganizationApp | undefined

  if (options.reset) {
    envIdentifiers = {app: undefined, extensions: {}}
  } else {
    const result = await getCachedApp(options.app, envIdentifiers.app, token)
    if (result === 'not_found') throw DeployAppNotFound(identifiers.app, options.app.dependencyManager)
    partnersApp = result
  }

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
    app: await updateAppIdentifiers({app: options.app, identifiers, environmentType: 'production'}),
  }
  return {
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
}

export async function fetchOrganizationAndFetchOrCreateApp(
  app: App,
  token: string,
): Promise<{partnersApp: OrganizationApp; orgId: string}> {
  const orgId = await selectOrg(token)
  const {organization, apps} = await fetchOrgsAppsAndStores(orgId, token)
  const partnersApp = await selectOrCreateApp(app, apps, organization, token, undefined)
  return {orgId, partnersApp}
}

async function fetchOrgsAppsAndStores(orgId: string, token: string): Promise<FetchResponse> {
  let data = {} as FetchResponse
  const list = new ui.Listr(
    [
      {
        title: 'Fetching organization data',
        task: async () => {
          const responses = await Promise.all([fetchOrgAndApps(orgId, token), fetchAllStores(orgId, token)])
          data = {...responses[0], stores: responses[1]} as FetchResponse
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
  org: Organization,
  stores: OrganizationStore[],
  token: string,
): Promise<{app?: OrganizationApp; store?: string}> {
  let selectedApp: OrganizationApp | undefined
  let selectedStore: string | undefined

  if (options.apiKey) {
    selectedApp = await fetchAppFromApiKey(options.apiKey, token)
    if (!selectedApp) throw InvalidApiKeyError(options.apiKey)
  }

  if (options.storeFqdn) {
    await convertToTestStoreIfNeeded(options.storeFqdn, stores, org, token)
    selectedStore = options.storeFqdn
  }

  return {app: selectedApp, store: selectedStore}
}

/**
 * Retrieve cached info from the global configuration based on the current local app
 * @param reset {boolean} Wheter to reset the cache or not
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
}): conf.CachedAppInfo | undefined {
  if (!apiKey) return undefined
  if (apiKey && reset) conf.clearAppInfo(directory)
  return conf.getAppInfo(directory)
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
function showReusedValues(org: string, app: App, store: string) {
  output.info('\nUsing your previous dev settings:')
  output.info(`Org:        ${org}`)
  output.info(`App:        ${app.name}`)
  output.info(`Dev store:  ${store}\n`)
  output.info(
    output.content`To reset your default dev config, run ${output.token.packagejsonScript(
      app.dependencyManager,
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
