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
const NoDevStoreError = (orgId: string) =>
  new error.Fatal('There are no developement stores available', CreateStoreLink(orgId))

const CreateStoreLink = (orgId: string) => {
  const url = `https://partners.shopify.com/${orgId}/stores/new?store_type=dev_store`
  return `Click here to create a new dev store to preview your project:\n${url}\n`
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
 * If there is cached info (user ran `dev` previously), check if it is still valid and return it
 * If there is no cached info (or is invalid):
 *  - Show prompts to select an org, app and dev store
 *  - The new selection will be saved as global configuration
 *  - The `shopify.app.toml` file will be updated with the new app apiKey
 *
 * @param app {App} Current local app information
 * @returns {Promise<DevEnvironmentOutput>} The selected org, app and dev store
 */
export async function ensureDevEnvironment(app: App): Promise<DevEnvironmentOutput> {
  const token = await session.ensureAuthenticatedPartners()

  const cachedInfo = getCachedInfo(app)
  const orgId = cachedInfo?.orgId || (await selectOrg(token))
  const {organization, apps, stores} = await fetchAppsAndStores(orgId, token)

  const cached = validateCachedInfo(apps, stores, cachedInfo)
  if (cached?.app && cached?.store) {
    showReusedValues(organization.businessName, cached.app.title, cached.store.shopDomain)
    return {org: organization, app: cached.app, store: cached.store}
  }

  const selectedApp = cached?.app || (await selectOrCreateApp(app, apps, orgId))
  conf.setAppInfo(selectedApp.apiKey, {orgId})
  updateAppConfigurationFile(app, {id: selectedApp.apiKey, name: selectedApp.title})
  const selectedStore = cached?.store || (await selectStore(stores, orgId))
  conf.setAppInfo(selectedApp.apiKey, {storeFqdn: selectedStore.shopDomain})

  return {org: organization, app: selectedApp, store: selectedStore}
}

function getCachedInfo(app: App): conf.CachedAppInfo | undefined {
  if (!app.configuration.id) return undefined
  return conf.getAppInfo(app.configuration.id)
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
 * Select an app from list or create a new one
 * If no apps exists, we automatically prompt the user to create a new one
 * @param app {App} Current local app information
 * @param apps {OrganizationApp[]} List of remote available apps
 * @param orgId {string} Current Organization
 * @returns {Promise<OrganizationApp>} The selected (or created) app
 */
async function selectOrCreateApp(localApp: App, apps: OrganizationApp[], orgId: string): Promise<OrganizationApp> {
  let app = await selectAppPrompt(apps)
  if (!app) app = await createApp(orgId, localApp)

  output.success(`Connected your project with ${app.title}`)
  return app
}

/**
 * Select store from list or
 * If there are no stores, show a link to create a store and prompt the user to refresh the store list
 * If no store is finally selected, exit process
 * @param stores {OrganizationStore[]} List of available stores
 * @param orgId {string} Current organization ID
 * @returns {Promise<OrganizationStore>} The selected store
 */
async function selectStore(stores: OrganizationStore[], orgId: string): Promise<OrganizationStore> {
  const store = await selectStorePrompt(stores)
  if (store) return store

  output.info(`\n${CreateStoreLink(orgId)}`)
  const reload = await reloadStoreListPrompt()
  if (!reload) process.exit()

  const token = await session.ensureAuthenticatedPartners()
  const data = await fetchAppsAndStores(orgId, token)
  return selectStore(data.stores, orgId)
}

/**
 * Check if the current cached info corresponds to a valid app and store from the current organization
 * @param apps {OrganizationApp[]} List of available apps
 * @param stores {OrganizationStore[]} List of available stores
 * @param info  {CachedAppInfo} Cached app info
 * @returns {app?: OrganizationApp; store?: OrganizationStore} App and store if they are valid
 */
function validateCachedInfo(
  apps: OrganizationApp[],
  stores: OrganizationStore[],
  info?: conf.CachedAppInfo,
): {app?: OrganizationApp; store?: OrganizationStore} {
  if (!info || !info.storeFqdn) return {}
  const selectedApp = apps.find((app) => app.apiKey === info.appId)
  const selectedStore = stores.find((store) => store.shopDomain === info.storeFqdn)
  return {app: selectedApp, store: selectedStore}
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
