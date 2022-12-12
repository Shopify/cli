import {appNamePrompt, appTypePrompt, createAsNewAppPrompt, selectAppPrompt} from '../../prompts/dev.js'
import {Organization, OrganizationApp, ScopelessOrganizationApp} from '../../models/organization.js'
import {fetchAppFromApiKey} from '../dev/fetch.js'
import {api, error, output} from '@shopify/cli-kit'

/**
 * Select an app from env, list or create a new one:
 * If a cachedAppId is provided, we check if it is valid and return it. If it's not valid, ignore it.
 * If there is no valid app yet, prompt the user to select one from the list or create a new one.
 * If no apps exists, we automatically prompt the user to create a new one.
 * @param app - Current local app information
 * @param apps - List of remote available apps
 * @param orgId - Current Organization
 * @param cachedAppId - Cached app apikey
 * @returns The selected (or created) app
 */
export async function selectOrCreateApp(
  localAppName: string,
  apps: ScopelessOrganizationApp[],
  org: Organization,
  token: string,
): Promise<OrganizationApp> {
  let createNewApp = apps.length === 0
  if (!createNewApp) {
    output.info(`\nBefore you preview your work, it needs to be associated with an app.\n`)
    createNewApp = await createAsNewAppPrompt()
  }
  if (createNewApp) {
    return createApp(org, localAppName, token)
  } else {
    const selectedApp = await selectAppPrompt(apps)
    const fullSelectedApp = await fetchAppFromApiKey(selectedApp.apiKey, token)
    return fullSelectedApp!
  }
}

export async function createApp(org: Organization, appName: string, token: string): Promise<OrganizationApp> {
  const name = await appNamePrompt(appName)

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
  const createdApp: OrganizationApp = result.appCreate.app
  createdApp.organizationId = org.id
  createdApp.newApp = true
  return createdApp
}
