import {api, error} from '@shopify/cli-kit'
import {ensureAuthenticatedPartners} from '$../../cli-kit/src/session'
import {App} from '$cli/models/app/app'
import {appNamePrompt, appTypePrompt} from '$cli/prompts/dev'
import {OrganizationApp} from '$cli/models/organization'

export async function createApp(orgId: string, app: App): Promise<OrganizationApp> {
  const name = await appNamePrompt(app.configuration.name)
  const type = await appTypePrompt()
  const token = await ensureAuthenticatedPartners()

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
  return result.appCreate.app
}
