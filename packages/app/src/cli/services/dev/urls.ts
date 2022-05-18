import {DevOptions} from '../dev'
import {api, error, output, plugins, session} from '@shopify/cli-kit'

export async function generateURL(input: DevOptions, frontendPort: number) {
  let url = `http://localhost:${frontendPort}`

  const hasExtensions: boolean =
    input.appManifest.extensions.ui.length > 0 ||
    input.appManifest.extensions.function.length > 0 ||
    input.appManifest.extensions.theme.length > 0
  const useTunnel = input.tunnel || hasExtensions

  if (useTunnel) {
    const tunnelPlugin = await plugins.lookupTunnelPlugin(input.plugins)
    if (tunnelPlugin === undefined) {
      throw new error.Abort('The tunnel plugin could not be found.', 'shopify plugins install ngrok')
    }
    url = await tunnelPlugin.start({port: frontendPort})
  }

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
    throw new error.Fatal(errors)
  }
  output.success('Allowed redirection URLs updated in Partners Dashboard')
}
