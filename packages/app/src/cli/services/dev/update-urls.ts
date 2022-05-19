import {api, error, output, session} from '@shopify/cli-kit'

export async function updateURLs(apiKey: string, url: string): Promise<void> {
  const token = await session.ensureAuthenticatedPartners()

  const variables: api.graphql.UpdateURLsQueryVariables = {
    apiKey,
    appUrl: url,
    redir: [`${url}/auth/callback`, `${url}/auth/shopify/callback`, `${url}/api/auth/callback`],
  }

  const query = api.graphql.UpdateURLsQuery
  const result: api.graphql.UpdateURLsQuerySchema = await api.partners.request(query, token, variables)
  if (result.appUpdate.userErrors.length > 0) {
    const errors = result.appUpdate.userErrors.map((error) => error.message).join(', ')
    throw new error.Abort(errors)
  }
  output.success('Allowed redirection URLs updated in Partners Dashboard')
}
