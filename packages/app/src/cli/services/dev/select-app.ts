import {api, error, output, session} from '@shopify/cli-kit'
import {App} from '$cli/models/app/app'
import {appNamePrompt, appTypePrompt, selectAppPrompt} from '$cli/prompts/dev'
import {OrganizationApp} from '$cli/models/organization'

const InvalidApiKeyError = (apiKey: string) => {
  return new error.Fatal(`Invalid API key: ${apiKey}`, 'Check that the provided API KEY is correct and try again.')
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
export async function selectOrCreateApp(
  localApp: App,
  apps: OrganizationApp[],
  orgId: string,
  cachedApiKey?: string,
  envApiKey?: string,
): Promise<OrganizationApp> {
  if (envApiKey) {
    const envApp = await appFromApiKey(envApiKey)
    if (envApp) return envApp
    throw InvalidApiKeyError(envApiKey)
  }

  if (cachedApiKey) {
    const cachedApp = await appFromApiKey(cachedApiKey)
    if (cachedApp) return cachedApp
  }

  let app = await selectAppPrompt(apps)
  if (!app) app = await createApp(orgId, localApp)

  output.success(`Connected your project with ${app.title}`)
  return app
}

/**
 * Check if the provided apiKey corresponds to an existing app (in any org the user belongs to)
 * @param apps {OrganizationApp[]} List of remote available apps
 * @param apiKey {string} API key to check
 * @returns {OrganizationApp} The app if it exists, undefined otherwise
 */
export async function appFromApiKey(apiKey: string): Promise<OrganizationApp> {
  const token = await session.ensureAuthenticatedPartners()
  const app: OrganizationApp = await api.partners.request(api.graphql.FindAppQuery, token, {apiKey})
  return app
}

export async function createApp(orgId: string, app: App): Promise<OrganizationApp> {
  const name = await appNamePrompt(app.configuration.name)
  const type = await appTypePrompt()
  const token = await session.ensureAuthenticatedPartners()
  const variables: api.graphql.CreateAppQueryVariables = {
    org: parseInt(orgId, 10),
    title: `${name}`,
    appUrl: 'https://shopify.github.io/shopify-cli/help/start-app/',
    redir: ['http://localhost:3456'],
    type,
  }

  const query = api.graphql.CreateAppQuery
  const result: api.graphql.CreateAppQuerySchema = await api.partners.request(query, token, variables)
  if (result.appCreate.userErrors.length > 0) {
    const errors = result.appCreate.userErrors.map((error) => error.message).join(', ')
    throw new error.Fatal(errors)
  }
  output.success(`🎉 ${result.appCreate.app.title} has been created on your Partners account`)
  return result.appCreate.app
}
