import {BaseProcess, DevProcessFunction} from './types.js'
import {urlNamespaces} from '../../../constants.js'
import {setupGraphiQLServer} from '../graphiql/server.js'
import {isSpinEnvironment, spinFqdn} from '@shopify/cli-kit/node/context/spin'

interface GraphiQLServerProcessOptions {
  appName: string
  appUrl: string
  apiKey: string
  apiSecret: string
  storeFqdn: string
  url: string
  port: number
  scopes: string[]
  shopCustomDomain: string | undefined
}

export interface GraphiQLServerProcess extends BaseProcess<GraphiQLServerProcessOptions> {
  type: 'graphiql'
  urlPrefix: string
}

export async function setupGraphiQLServerProcess(
  options: Omit<GraphiQLServerProcessOptions, 'port' | 'shopCustomDomain'>,
): Promise<GraphiQLServerProcess> {
  const shopCustomDomain = isSpinEnvironment() ? `shopify.${await spinFqdn()}` : undefined

  return {
    type: 'graphiql',
    prefix: `graphiql`,
    urlPrefix: `/${urlNamespaces.devTools}/graphiql`,
    options: {...options, port: -1, shopCustomDomain},
    function: launchGraphiQLServer,
  }
}

export const launchGraphiQLServer: DevProcessFunction<GraphiQLServerProcessOptions> = async (
  {stdout, stderr, abortSignal},
  options: GraphiQLServerProcessOptions,
) => {
  const httpServer = setupGraphiQLServer({...options, stdout})
  abortSignal.addEventListener('abort', async () => {
    await httpServer.close()
  })
}
