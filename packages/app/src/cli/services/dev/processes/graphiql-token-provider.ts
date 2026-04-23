import {TokenProvider} from '@shopify/cli-kit/node/graphiql/server'
import {fetch} from '@shopify/cli-kit/node/http'

interface ClientCredentialsTokenProviderOptions {
  apiKey: string
  apiSecret: string
  storeFqdn: string
}

/**
 * Returns a `TokenProvider` that mints Admin API tokens via OAuth `client_credentials`
 * using a Partners app's `apiKey` + `apiSecret`. Tokens are cached in-memory and
 * re-minted on demand when `refreshToken` is called (e.g. on a 401 from upstream).
 *
 * This is the strategy used by `shopify app dev`'s GraphiQL server. It assumes the app
 * is installed on the target store and that the app secret can mint a fresh token at any time.
 */
export function createClientCredentialsTokenProvider({
  apiKey,
  apiSecret,
  storeFqdn,
}: ClientCredentialsTokenProviderOptions): TokenProvider {
  let cachedToken: string | undefined

  const mint = async (): Promise<string> => {
    const tokenResponse = await fetch(`https://${storeFqdn}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        client_id: apiKey,
        client_secret: apiSecret,
        grant_type: 'client_credentials',
      }),
    })

    const tokenJson = (await tokenResponse.json()) as {access_token: string}
    cachedToken = tokenJson.access_token
    return cachedToken
  }

  return {
    getToken: async () => cachedToken ?? mint(),
    refreshToken: async () => {
      cachedToken = undefined
      return mint()
    },
  }
}
