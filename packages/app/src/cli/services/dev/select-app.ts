import {fetchAppFromApiKey} from './fetch'
import {api, error, output} from '@shopify/cli-kit'
import {App} from '$cli/models/app/app'
import {appNamePrompt, selectAppPrompt} from '$cli/prompts/dev'
import {OrganizationApp} from '$cli/models/organization'

/**
 * Select an app from env, list or create a new one:
 * If a cachedAppId is provided, we check if it is valid and return it. If it's not valid, ignore it.
 * If there is no valid app yet, prompt the user to select one from the list or create a new one.
 * If no apps exists, we automatically prompt the user to create a new one.
 * @param app {App} Current local app information
 * @param apps {OrganizationApp[]} List of remote available apps
 * @param orgId {string} Current Organization
 * @param cachedAppId {string} Cached app apikey
 * @returns {Promise<OrganizationApp>} The selected (or created) app
 */
export async function selectOrCreateApp(
  localApp: App,
  apps: OrganizationApp[],
  orgId: string,
  token: string,
  cachedApiKey?: string,
): Promise<OrganizationApp> {
  if (cachedApiKey) {
    const cachedApp = await fetchAppFromApiKey(cachedApiKey, token)
    if (cachedApp) return cachedApp
  }

  let app = await selectAppPrompt(apps)
  if (!app) app = await createApp(orgId, localApp, token)

  output.success(`Connected your project with ${app.title}`)
  return app
}

export async function createApp(orgId: string, app: App, token: string): Promise<OrganizationApp> {
  const name = await appNamePrompt(app.configuration.name)
  const variables: api.graphql.CreateAppQueryVariables = {
    org: parseInt(orgId, 10),
    title: `${name}`,
    appUrl: 'https://shopify.github.io/shopify-cli/help/start-app/',
    redir: ['http://localhost:3456'],
  }

  const query = api.graphql.CreateAppQuery
  const result: api.graphql.CreateAppQuerySchema = await api.partners.request(query, token, variables)
  if (result.appCreate.userErrors.length > 0) {
    const errors = result.appCreate.userErrors.map((error) => error.message).join(', ')
    throw new error.Fatal(errors)
  }
  console.log(result.appCreate.app)
  output.success(`🎉 ${result.appCreate.app.title} has been created on your Partners account`)
  return result.appCreate.app
}
