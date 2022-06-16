import {api, error, output, plugins, session} from '@shopify/cli-kit'
import {Plugin} from '@oclif/core/lib/interfaces'

export async function generateURL(pluginList: Plugin[], frontendPort: number): Promise<string> {
  const tunnelPlugin = await plugins.lookupTunnelPlugin(pluginList)
  if (!tunnelPlugin) throw new error.Bug('The tunnel could not be found')
  const url = await tunnelPlugin?.start({port: frontendPort})
  output.success('The tunnel is running and you can now view your app')
  return url
}

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
}
