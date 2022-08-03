import {fetchAppFromApiKey} from './fetch.js'
import {appNamePrompt, appTypePrompt, createAsNewAppPrompt, selectAppPrompt} from '../../prompts/dev.js'
import {AppInterface} from '../../models/app/app.js'
import {Organization, OrganizationApp} from '../../models/organization.js'
import {api, error, output} from '@shopify/cli-kit'

/**
 * Select an app from env, list or create a new one:
 * If a cachedAppId is provided, we check if it is valid and return it. If it's not valid, ignore it.
 * If there is no valid app yet, prompt the user to select one from the list or create a new one.
 * If no apps exists, we automatically prompt the user to create a new one.
 * @param app {AppInterface} Current local app information
 * @param apps {OrganizationApp[]} List of remote available apps
 * @param orgId {string} Current Organization
 * @param cachedAppId {string} Cached app apikey
 * @returns {Promise<OrganizationApp>} The selected (or created) app
 */
export async function selectOrCreateApp(
  localApp: AppInterface,
  apps: OrganizationApp[],
  org: Organization,
  token: string,
  cachedApiKey?: string,
): Promise<OrganizationApp> {
  if (cachedApiKey) {
    const cachedApp = await fetchAppFromApiKey(cachedApiKey, token)
    if (cachedApp) return cachedApp
  }

  let createNewApp = apps.length === 0
  if (!createNewApp) createNewApp = await createAsNewAppPrompt()
  const app = createNewApp ? await createApp(org, localApp, token) : await selectAppPrompt(apps)

  return app
}

export async function createApp(org: Organization, app: AppInterface, token: string): Promise<OrganizationApp> {
  const name = await appNamePrompt(app.name)

  const type = org.appsNext ? 'undecided' : await appTypePrompt()
  const variables: api.graphql.CreateAppQueryVariables = {
    org: parseInt(org.id, 10),
    title: `${name}`,
    appUrl: 'https://example.com',
    redir: ['https://example.com/api/auth'],
    type,
  }

  const query = api.graphql.CreateAppQuery
  const result: api.graphql.CreateAppQuerySchema = await api.partners.request(query, token, variables)
  if (result.appCreate.userErrors.length > 0) {
    const errors = result.appCreate.userErrors.map((error) => error.message).join(', ')
    throw new error.Abort(errors)
  }

  output.success(`${result.appCreate.app.title} has been created on your Partners account`)
  const createdApp = result.appCreate.app
  createdApp.organizationId = org.id
  return createdApp
}
