import {createApp} from './create-app'
import {api, error, session, store as conf} from '@shopify/cli-kit'
import {selectAppPrompt, selectOrganizationPrompt, selectStorePrompt} from '$cli/prompts/dev'
import {App} from '$cli/models/app/app'
import {Organization, OrganizationApp, OrganizationStore} from '$cli/models/organization'
import {updateAppConfigurationFile} from '$cli/utilities/app/update'
import {CachedAppInfo, getAppInfo} from '$../../cli-kit/src/store'

const NoOrgError = () =>
  new error.Fatal(
    'No Organization found',
    'You need to create a Shopify Partners organization: https://partners.shopify.com/signup ',
  )
const NoDevStoreError = (orgId: string) =>
  new error.Fatal(
    'There are no developement stores available',
    `Please create a store in the Shopify Partners dashboard: https://partners.shopify.com/${orgId}/stores/new?store_type=dev_store`,
  )

const StoreNotFound = (name: string) =>
  new error.Fatal(`The provided store domain (${name}) could not be found in your organization`)

/**
 * Check that the project is connected to an app in partners dashboard
 * If not, select an organization and select/create an app
 *
 * Check that there is a development store selected
 * If not, select an existing store (or create one)
 *
 * Check that this store has the current app installed
 * If not, redirect the user to install it
 * @param app {App} Current local app information
 * @param envStore {string} Optional store passed via env variable/flag
 */
export async function ensureDevEnvironment(app: App): Promise<{app: OrganizationApp; store: OrganizationStore}> {
  const token = await session.ensureAuthenticatedPartners()

  const cachedInfo: CachedAppInfo | undefined = getCachedInfo(app)

  const orgId = await selectOrg(token, cachedInfo)
  const {apps, stores} = await fetchAppsAndStores(orgId, token)
  const selectedApp = await selectOrCreateApp(app, apps, orgId, cachedInfo)

  conf.setAppInfo(selectedApp.apiKey, {orgId})
  updateAppConfigurationFile(app, {id: selectedApp.apiKey, name: selectedApp.title})

  const selectedStore = await selectStore(stores, orgId, cachedInfo?.storeFqdn)

  conf.setAppInfo(selectedApp.apiKey, {storeFqdn: selectedStore.shopDomain})

  return {app: selectedApp, store: selectedStore}
}

function getCachedInfo(app: App): CachedAppInfo | undefined {
  if (!app.configuration.id) return undefined
  const cachedInfo = getAppInfo(app.configuration.id)
  if (cachedInfo) return cachedInfo
  return undefined
}

async function selectOrg(token: string, cachedInfo?: CachedAppInfo): Promise<string> {
  if (cachedInfo?.orgId) return cachedInfo.orgId
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
async function selectOrCreateApp(
  localApp: App,
  apps: OrganizationApp[],
  orgId: string,
  cachedInfo?: CachedAppInfo,
): Promise<OrganizationApp> {
  if (cachedInfo?.appId) {
    const selectedApp = apps.find((app) => app.apiKey === cachedInfo.appId)
    if (selectedApp) return selectedApp
  }
  const selectedApp = await selectAppPrompt(apps)
  if (selectedApp) return selectedApp
  return createApp(orgId, localApp)
}

/**
 * Select store from list or throw error if there aren't any
 * If a store is provided via env, check that this store exists in user org and automatically select it
 * @param stores {OrganizationStore[]} List of available stores
 * @param orgId {string} Current organization ID
 * @param envStore {string} Optional store passed via env variable/flag
 * @returns {Promise<OrganizationStore>} The selected store
 */
async function selectStore(
  stores: OrganizationStore[],
  orgId: string,
  previousStore?: string,
): Promise<OrganizationStore> {
  if (previousStore) {
    const store = stores.find((store) => store.shopDomain === previousStore)
    if (store) return store
  }
  const store = await selectStorePrompt(stores)
  if (store) return store
  throw NoDevStoreError(orgId)
}

async function fetchOrganizations(token: string): Promise<Organization[]> {
  const query = api.graphql.AllOrganizationsQuery
  const result: api.graphql.AllOrganizationsQuerySchema = await api.partners.request(query, token)
  const organizations = result.organizations.nodes
  if (organizations.length === 0) throw NoOrgError()
  return organizations
}

async function fetchAppsAndStores(
  orgId: string,
  token: string,
): Promise<{apps: OrganizationApp[]; stores: OrganizationStore[]}> {
  const query = api.graphql.FindOrganizationQuery
  const result: api.graphql.FindOrganizationQuerySchema = await api.partners.request(query, token, {id: orgId})
  const org = result.organizations.nodes[0]
  if (!org) throw NoOrgError()
  return {apps: org.apps.nodes, stores: org.stores.nodes}
}
