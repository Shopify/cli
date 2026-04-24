import {BaseProcess, DevProcessFunction} from './types.js'
import {setupGraphiQLServer, TokenProvider} from '@shopify/cli-kit/node/graphiql/server'
import {fetch} from '@shopify/cli-kit/node/http'

interface GraphiQLServerProcessOptions {
  appName: string
  appUrl: string
  apiKey: string
  apiSecret: string
  storeFqdn: string
  key?: string
  port: number
}

export interface GraphiQLServerProcess extends BaseProcess<GraphiQLServerProcessOptions> {
  type: 'graphiql'
}

export async function setupGraphiQLServerProcess(
  options: GraphiQLServerProcessOptions,
): Promise<GraphiQLServerProcess> {
  return {
    type: 'graphiql',
    prefix: `graphiql`,
    options,
    function: launchGraphiQLServer,
  }
}

export const launchGraphiQLServer: DevProcessFunction<GraphiQLServerProcessOptions> = async (
  {stdout, abortSignal},
  options: GraphiQLServerProcessOptions,
) => {
  const tokenProvider = createClientCredentialsTokenProvider({
    apiKey: options.apiKey,
    apiSecret: options.apiSecret,
    storeFqdn: options.storeFqdn,
  })
  const httpServer = setupGraphiQLServer({
    stdout,
    port: options.port,
    storeFqdn: options.storeFqdn,
    key: options.key,
    tokenProvider,
    appContext: {
      appName: options.appName,
      appUrl: options.appUrl,
      apiSecret: options.apiSecret,
    },
  })
  abortSignal.addEventListener('abort', async () => {
    httpServer.close()
  })
}

/**
 * In-memory token provider that mints Admin API tokens via OAuth `client_credentials`
 * using the Partners app's `apiKey` + `apiSecret`. Refreshes lazily and re-mints on demand.
 */
function createClientCredentialsTokenProvider(options: {
  apiKey: string
  apiSecret: string
  storeFqdn: string
}): TokenProvider {
  let cachedToken: string | undefined

  const mint = async (): Promise<string> => {
    const tokenResponse = await fetch(`https://${options.storeFqdn}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        client_id: options.apiKey,
        client_secret: options.apiSecret,
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
