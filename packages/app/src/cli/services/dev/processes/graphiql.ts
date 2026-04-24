import {BaseProcess, DevProcessFunction} from './types.js'
import {createClientCredentialsTokenProvider} from './graphiql-token-provider.js'
import {setupGraphiQLServer} from '@shopify/cli-kit/node/graphiql/server'

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
