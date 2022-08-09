import {api, error, output, plugins} from '@shopify/cli-kit'
import {Plugin} from '@oclif/core/lib/interfaces'

export async function generateURL(pluginList: Plugin[], frontendPort: number): Promise<string> {
  const tunnelPlugin = await plugins.lookupTunnelPlugin(pluginList)
  if (!tunnelPlugin) throw new error.Bug('The tunnel could not be found')
  const url = await tunnelPlugin?.start({port: frontendPort})
  output.success('The tunnel is running and you can now view your app')
  return url
}

export async function updateURLs(apiKey: string, url: string, token: string): Promise<void> {
  const variables: api.graphql.UpdateURLsQueryVariables = {
    apiKey,
    appUrl: url,
    redir: [`${url}/auth/callback`, `${url}/auth/shopify/callback`, `${url}/api/auth/callback`],
  }

  const query = api.graphql.UpdateURLsQuery
  return api.partners.request<api.graphql.UpdateURLsQuerySchema>(query, token, variables).match(
    (result) => {
      if (result.appUpdate.userErrors.length > 0) {
        const errors = result.appUpdate.userErrors.map((error) => error.message).join(', ')
        throw new error.Abort(errors)
      }
    },
    (error) => {
      throw error
    },
  )
}
