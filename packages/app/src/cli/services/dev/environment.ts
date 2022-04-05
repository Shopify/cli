import {createApp} from './create-app'
import {api, error, output, session, store as conf} from '@shopify/cli-kit'
import {reloadStoreListPrompt, selectAppPrompt, selectOrganizationPrompt, selectStorePrompt} from '$cli/prompts/dev'
import {App} from '$cli/models/app/app'
import {Organization, OrganizationApp, OrganizationStore} from '$cli/models/organization'
import {updateAppConfigurationFile} from '$cli/utilities/app/update'

const NoOrgError = () =>
  new error.Fatal(
    'No Organization found',
    'You need to create a Shopify Partners organization: https://partners.shopify.com/signup ',
  )

const InvalidApiKeyError = (apiKey: string) => {
  return new error.Fatal(`Invalid API key: ${apiKey}`, 'Check that the provided API KEY is correct and try again.')
}

const InvalidStoreError = (apiKey: string) => {
  return new error.Fatal(`Invalid Store domain: ${apiKey}`, 'Check that the provided Store is correct and try again.')
}

const CreateStoreLink = (orgId: string) => {
  const url = `https://partners.shopify.com/${orgId}/stores/new?store_type=dev_store`
  return `Click here to create a new dev store to preview your project:\n${url}\n`
}

export interface DevEnvironmentInput {
  appManifest: App
  apiKey?: string
  store?: string
  reset: boolean
}

interface DevEnvironmentOutput {
  org: Organization
  app: OrganizationApp
  store: OrganizationStore
}

interface FetchResponse {
  organization: Organization
  apps: OrganizationApp[]
  stores: OrganizationStore[]
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
 * @param app {App} Current local app information
 * @returns {Promise<DevEnvironmentOutput>} The selected org, app and dev store
 */
export async function ensureDevEnvironment(input: DevEnvironmentInput): Promise<DevEnvironmentOutput> {
  const token = await session.ensureAuthenticatedPartners()

  const cachedInfo = getCachedInfo(input.reset, input.appManifest.configuration.id)
  const orgId = cachedInfo?.orgId || (await selectOrg(token))
  const {organization, apps, stores} = await fetchAppsAndStores(orgId, token)

  const selectedApp = await selectOrCreateApp(input.appManifest, apps, orgId, cachedInfo?.appId, input.apiKey)
  conf.setAppInfo(selectedApp.apiKey, {orgId})
  updateAppConfigurationFile(input.appManifest, {id: selectedApp.apiKey, name: selectedApp.title})
  const selectedStore = await selectStore(stores, orgId, cachedInfo?.storeFqdn, input.store)
  conf.setAppInfo(selectedApp.apiKey, {storeFqdn: selectedStore.shopDomain})

  return {org: organization, app: selectedApp, store: selectedStore}
}

/**
 * Retrieve cached info from the global configuration based on the current local app
 * @param reset {boolean} Wheter to reset the cache or not
 * @param appId {string} Current local app id, used to retrieve the cached info
 * @returns
 */
function getCachedInfo(reset: boolean, apiKey?: string): conf.CachedAppInfo | undefined {
  if (!apiKey) return undefined
  if (apiKey && reset) conf.clearAppInfo(apiKey)
  return conf.getAppInfo(apiKey)
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
 * Select an app from env, list or create a new one:
 * If an envApiKey is provided, we check if it is valid and return it. If it's not valid, throw error
 * If a cachedAppId is provided, we check if it is valid and return it. If it's not valid, ignore it.
 * If there is no valid app yet, prompt the user to select one from the list or create a new one.
 * If no apps exists, we automatically prompt the user to create a new one.
 * @param app {App} Current local app information
 * @param apps {OrganizationApp[]} List of remote available apps
 * @param orgId {string} Current Organization
 * @param cachedAppId {string} Cached app apikey
 * @param envApiKey {string} API key from the environment/flag
 * @returns {Promise<OrganizationApp>} The selected (or created) app
 */
async function selectOrCreateApp(
  localApp: App,
  apps: OrganizationApp[],
  orgId: string,
  cachedApiKey?: string,
  envApiKey?: string,
): Promise<OrganizationApp> {
  if (envApiKey) {
    const envApp = validateApiKey(apps, envApiKey)
    if (envApp) return envApp
    throw InvalidApiKeyError(envApiKey)
  }

  const cachedApp = validateApiKey(apps, cachedApiKey)
  if (cachedApp) return cachedApp

  let app = await selectAppPrompt(apps)
  if (!app) app = await createApp(orgId, localApp)

  output.success(`Connected your project with ${app.title}`)
  return app
}

/**
 * Check if the provided apiKey exists in the list of retrieved apps
 * @param apps {OrganizationApp[]} List of remote available apps
 * @param apiKey {string} API key to check
 * @returns {OrganizationApp} The app if it exists, undefined otherwise
 */
function validateApiKey(apps: OrganizationApp[], apiKey?: string) {
  return apps.find((app) => app.apiKey === apiKey)
}

/**
 *  Check if the provided storeDomain exists in the list of retrieved stores
 * @param stores {OrganizationStore[]} List of remote available stores
 * @param storeDomain {string} Store domain to check
 * @returns {OrganizationStore} The store if it exists, undefined otherwise
 */
function validateStore(stores: OrganizationStore[], storeDomain?: string) {
  return stores.find((store) => store.shopDomain === storeDomain)
}

/**
 * Select store from list or
 * If an envStore is provided, we check if it is valid and return it. If it's not valid, throw error
 * If a cachedStoreName is provided, we check if it is valid and return it. If it's not valid, ignore it.
 * If there are no stores, show a link to create a store and prompt the user to refresh the store list
 * If no store is finally selected, exit process
 * @param stores {OrganizationStore[]} List of available stores
 * @param orgId {string} Current organization ID
 * @param cachedStoreName {string} Cached store name
 * @param envStore {string} Store from the environment/flag
 * @returns {Promise<OrganizationStore>} The selected store
 */
async function selectStore(
  stores: OrganizationStore[],
  orgId: string,
  cachedStoreName?: string,
  envStore?: string,
): Promise<OrganizationStore> {
  if (envStore) {
    const envStoreInfo = validateStore(stores, envStore)
    if (envStoreInfo) return envStoreInfo
    throw InvalidStoreError(envStore)
  }

  const cachedStore = validateStore(stores, cachedStoreName)
  if (cachedStore) return cachedStore

  const store = await selectStorePrompt(stores)
  if (store) return store

  output.info(`\n${CreateStoreLink(orgId)}`)
  const reload = await reloadStoreListPrompt()
  if (!reload) throw new error.AbortSilent()

  const token = await session.ensureAuthenticatedPartners()
  const data = await fetchAppsAndStores(orgId, token)
  return selectStore(data.stores, orgId)
}

/**
 * Message shown to the user in case we are reusing a previous configuration
 * @param org {string} Organization name
 * @param app {string} App name
 * @param store {string} Store domain
 */
function showReusedValues(org: string, app: string, store: string) {
  output.info(`\nReusing the org, app, dev store settings from your last run:`)
  output.info(`Organization: ${org}`)
  output.info(`App: ${app}`)
  output.info(`Dev store: ${store}\n`)
  output.info('To change your default settings, use the following flags:')
  output.info(`--app to change your app`)
  output.info('--store to change your dev store')
  output.info('--reset to reset all your settings\n')
}

/**
 * Fetch all organizations the user belongs to
 * If the user doesn't belong to any org, throw an error
 * @param token {string} Token to access partners API
 * @returns {Promise<Organization[]>} List of organizations
 */
async function fetchOrganizations(token: string): Promise<Organization[]> {
  const query = api.graphql.AllOrganizationsQuery
  const result: api.graphql.AllOrganizationsQuerySchema = await api.partners.request(query, token)
  const organizations = result.organizations.nodes
  if (organizations.length === 0) throw NoOrgError()
  return organizations
}

/**
 * Fetch all apps and stores for the given organization
 * @param orgId {string} Organization ID
 * @param token {string} Token to access partners API
 * @returns {Promise<FetchResponse>} Current organization details and list of apps and stores
 */
async function fetchAppsAndStores(orgId: string, token: string): Promise<FetchResponse> {
  const query = api.graphql.FindOrganizationQuery
  const result: api.graphql.FindOrganizationQuerySchema = await api.partners.request(query, token, {id: orgId})
  const org = result.organizations.nodes[0]
  if (!org) throw NoOrgError()
  const parsedOrg = {id: org.id, businessName: org.businessName}
  return {organization: parsedOrg, apps: org.apps.nodes, stores: org.stores.nodes}
}
