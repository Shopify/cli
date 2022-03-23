import {App} from '../models/app/app'
import {api, queries, session, ui} from '@shopify/cli-kit'
import {Organization, OrganizationsQuerySchema} from '@shopify/cli-kit/src/api/graphql/all_orgs_with_apps'

interface DevOptions {
  app: App
}

export default devInit

async function devInit({app}: DevOptions) {
  if (app.configuration.id) {
    // App is connected to an org an a remote app
  } else {
    const org = await selectOrganization()
    const remoteApp = await selectApp()
  }
  // Load environment
  // Select Org
  // Select App
  // Select DevStore
}

async function selectOrganization(): Promise<Organization> {
  const token = await session.ensureAuthenticatedPartners()
  console.log(token)
  const query = queries.OrganizationsQuery
  const result: OrganizationsQuerySchema = await api.partners.request(query, token)

  const organizations = result.organizations.nodes
  if (organizations.length === 1) {
    return organizations[0]
  }

  const questions: ui.Question = {
    type: 'select',
    name: 'name',
    message: 'To which partner organization does this project belong',
    choices: organizations.map((org: any) => org.businessName),
  }
  const choice: {name: string} = await ui.prompt([questions])
  const chosen: Organization = organizations.find((org: any) => org.businessName === choice.name)!
  return chosen
}

async function selectApp() {}
