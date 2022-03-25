import {selectApp, selectOrganization, selectStore} from './questions'
import {api, error, output, queries, session} from '@shopify/cli-kit'
import {App, updateAppConfigurationFile} from '$cli/models/app/app'

export interface Organization {
  id: string
  businessName: string
  website: string
}

export interface OrganizationApp {
  id: string
  title: string
  apiKey: string
  apiSecretKeys: {
    secret: string
  }
  appType: string
}

export interface OrganizationStore {
  shopId: string
  link: string
  shopDomain: string
  shopName: string
  transferDisabled: boolean
  convertableToPartnerTest: boolean
}

/**
 * Check that the project is connected to an app in partners dashboard
 * If not, select an organization and select/create an app
 *
 * Check that there is a development store selected
 * If not, select an existing store (or create one)
 *
 * Check that this store has the current app installed
 * If not, redirect the user to install it
 * @param app
 */
export async function ensureValidDevEnvironment(app: App): Promise<void> {
  const token = await session.ensureAuthenticatedPartners()
  const orgs = await fetchOrganizations(token)
  const org = await selectOrganization(orgs)
  const {apps, stores} = await fetchAppsAndStores(org.id, token)
  const selectedApp = await selectOrCreateApp(apps, org.id, token)

  updateAppConfigurationFile(app, {id: selectedApp.apiKey, name: selectedApp.title})

  const selectedStore = await selectOrCreateStore(stores, org.id)
  // NEXT: check if app is installed or redirect to install app
  output.info(`Connected to ${selectedApp.title} and ${selectedStore.shopName}`)
}

async function selectOrCreateApp(apps: OrganizationApp[], orgId: string, token: string): Promise<OrganizationApp> {
  const app = await selectApp(apps)
  if (app) return app
  output.info('TODO: Create a new app')
  const newApp: any = {}
  return newApp
}

async function selectOrCreateStore(stores: OrganizationStore[], orgId: string): Promise<OrganizationStore> {
  const store = await selectStore(stores)
  if (store) return store
  // Temporary error while we can't create a store from CLI
  throw new error.Fatal(
    'There are no developement stores available',
    'Please create a store in the Shopify Partners dashboard',
  )
}

async function fetchOrganizations(token: string): Promise<Organization[]> {
  const query = queries.AllOrganizationsQuery
  const result: queries.AllOrganizationsQuerySchema = await api.partners.request(query, token)
  const organizations = result.organizations.nodes
  if (organizations.length === 0) {
    throw new error.Fatal('No Organization found', 'You need to create a Shopify Partners organization first')
  }
  return organizations
}

async function fetchAppsAndStores(
  orgId: string,
  token: string,
): Promise<{apps: OrganizationApp[]; stores: OrganizationStore[]}> {
  const query = queries.FindOrganizationQuery
  const result: queries.FindOrganizationQuerySchema = await api.partners.request(query, token, {id: orgId})
  const org = result.organizations.nodes[0]
  if (!org) throw new error.Fatal('Invalid Organization')
  return {apps: org.apps.nodes, stores: org.stores.nodes}
}
