import {api, error, output, plugins} from '@shopify/cli-kit'
import {Config} from '@oclif/core'

export async function generateURL(config: Config, frontendPort: number): Promise<string> {
  // For the moment we assume to always have ngrok, this will change in a future PR
  // and will need to use "getListOfTunnelPlugins" to find the available tunnel plugins
  const result = await plugins.runTunnelPlugin(config, frontendPort, 'ngrok')

  if (result.error === 'multiple-urls') throw new error.Bug('Mulitple tunnel plugins for ngrok found')
  if (result.error === 'no-urls' || !result.url) throw new error.Bug('Ngrok failed to start the tunnel')

  output.success('The tunnel is running and you can now view your app')
  return result.url
}

export async function updateURLs(apiKey: string, url: string, token: string): Promise<void> {
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
