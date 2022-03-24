import {App, updateAppConfigurationFile} from '../models/app/app'
import {api, error, output, path, queries, session, ui} from '@shopify/cli-kit'
import {configurationFileNames} from '$cli/constants'

interface DevOptions {
  app: App
}

interface OrganizationApp {
  id: string
  title: string
  apiKey: string
  apiSecretKeys: {
    secret: string
  }
  appType: string
}

interface OrganizationStore {
  shopId: string
  link: string
  shopDomain: string
  shopName: string
  transferDisabled: boolean
  convertableToPartnerTest: boolean
}

async function devInit({app}: DevOptions) {
  const {appId, store} = await configureDevEnvironment(app)
  if (appId && store) {
    output.success(`Connected app ${appId} to store ${store}`)
  }
}

async function configureDevEnvironment(app: App): Promise<{appId: string; store: string}> {
  if (app.configuration.id) {
    // App is already connected to an org an a remote app
    // TODO: Check if we have a dev store for this app
  }

  const token = await session.ensureAuthenticatedPartners()
  const org = await selectOrganization(token)
  const {apps, stores} = await fetchAppsAndStores(org.id, token)
  let selectedApp = await selectApp(apps)

  if (!selectedApp) {
    selectedApp = await createApp(org.id, token)
  }

  app.configuration.id = selectedApp.apiKey
  app.configuration.name = selectedApp.title
  updateAppConfigurationFile(app)

  let selectedStore = await selectStore(stores)
  if (!selectedStore) {
    selectedStore = await createDevStore(org.id, token)
  }

  return {appId: selectedApp!.id, store: selectedStore!.shopId}
}

async function createApp(orgId: string, token: string): Promise<OrganizationApp> {
  output.info('TODO: Create a new app')
  const app: any = {}
  return app
}

async function createDevStore(orgId: string, token: string): Promise<OrganizationStore> {
  output.info('TODO: Create a new dev store')
  const store: any = {}
  return store
}

async function selectOrganization(token: string): Promise<{id: string; businessName: string}> {
  const query = queries.AllOrganizationsQuery
  const result: queries.AllOrganizationsQuerySchema = await api.partners.request(query, token)
  const organizations = result.organizations.nodes
  if (organizations.length === 1) {
    return organizations[0]
  }
  if (organizations.length === 0) {
    throw new error.Fatal('You need to create a Shopify Partners organization first')
  }

  const questions: ui.Question = {
    type: 'select',
    name: 'name',
    message: 'Which org would you like to work in?',
    choices: organizations.map((org: any) => org.businessName),
  }
  const choice: {name: string} = await ui.prompt([questions])
  const org = organizations.find((org: any) => org.businessName === choice.name)
  if (!org) {
    throw new error.Fatal('Could not find organization')
  }
  return org
}

async function fetchAppsAndStores(
  orgId: string,
  token: string,
): Promise<{apps: OrganizationApp[]; stores: OrganizationStore[]}> {
  const query = queries.FindOrganizationQuery
  const result: queries.FindOrganizationQuerySchema = await api.partners.request(query, token, {id: orgId})
  const org = result.organizations.nodes[0]
  if (!org) {
    throw new error.Fatal('Invalid Organization')
  }
  return {apps: org.apps.nodes, stores: org.stores.nodes}
}

async function selectApp(apps: OrganizationApp[]): Promise<OrganizationApp | undefined> {
  if (apps.length === 0) return undefined
  const appList = apps.map((app) => app.title)
  const createOption = 'Create a new app...'
  appList.push(createOption)

  const questions: ui.Question = {
    type: 'select',
    name: 'title',
    message: 'Which existing app would you like to connect this work to?',
    choices: appList,
  }
  const choice: {title: string} = await ui.prompt([questions])
  if (choice.title === createOption) return undefined
  return apps.find((app: any) => app.title === choice.title)
}

async function selectStore(stores: OrganizationStore[]): Promise<OrganizationStore | undefined> {
  if (stores.length === 0) return undefined
  const storeList = stores.map((store) => store.shopName)
  const createOption = 'Create a new store...'
  storeList.push(createOption)

  const questions: ui.Question = {
    type: 'select',
    name: 'shopName',
    message: 'Where would you like to view your project? Select a dev store',
    choices: storeList,
  }
  const choice: {shopName: string} = await ui.prompt([questions])
  if (choice.shopName === createOption) return undefined
  return stores.find((store: any) => store.shopName === choice.shopName)
}

export default devInit
