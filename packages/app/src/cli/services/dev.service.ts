import {App} from '../models/app/app'
import {api, error, output, queries, session, ui} from '@shopify/cli-kit'

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
  if (app.configuration.id) {
    // App is connected to an org an a remote app
    return
  }

  const token = await session.ensureAuthenticatedPartners()
  const org = await selectOrganization(token)
  const allApps = await fetchApps(org, token)
  const selectedApp = await selectApp(allApps)
  if (selectedApp) {
    output.message(`TODO: Connect project to app ${selectedApp.title}`)
  } else {
    output.message('TODO: Create app')
  }
}

async function selectOrganization(token: string): Promise<string> {
  const query = queries.AllOrganizationsQuery
  const result: queries.AllOrganizationsQuerySchema = await api.partners.request(query, token)
  const organizations = result.organizations.nodes
  if (organizations.length === 1) {
    return organizations[0].id
  }
  if (organizations.length === 0) {
    throw new error.Fatal('You need to create an Shopify Partners organization first')
  }

  const questions: ui.Question = {
    type: 'select',
    name: 'name',
    message: 'Which org would you like to work in?',
    choices: organizations.map((org: any) => org.businessName),
  }
  const choice: {name: string} = await ui.prompt([questions])
  const orgId = organizations.find((org: any) => org.businessName === choice.name)?.id
  if (!orgId) {
    throw new error.Fatal('Could not find organization')
  }
  return orgId
}

async function fetchApps(orgId: string, token: string): Promise<OrganizationApp[]> {
  const query = queries.FindOrganizationQuery
  const result: queries.FindOrganizationQuerySchema = await api.partners.request(query, token, {id: orgId})
  const org = result.organizations.nodes[0]
  if (!org) {
    throw new error.Fatal('Invalid Organization')
  }
  return org.apps.nodes
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

export default devInit
