import {BaseProcess, DevProcessFunction} from './types.js'
import {urlNamespaces} from '../../../constants.js'
import {setupGraphiQLServer} from '../graphiql/server.js'

interface GraphiQLServerProcessOptions {
  appName: string
  appUrl: string
  apiKey: string
  apiSecret: string
  storeFqdn: string
  url: string
  port: number
}

export interface GraphiQLServerProcess extends BaseProcess<GraphiQLServerProcessOptions> {
  type: 'graphiql'
  urlPrefix: string
}

export async function setupGraphiQLServerProcess(
  options: Omit<GraphiQLServerProcessOptions, 'port'>,
): Promise<GraphiQLServerProcess> {
  return {
    type: 'graphiql',
    prefix: `graphiql`,
    urlPrefix: `/${urlNamespaces.devTools}/graphiql`,
    options: {...options, port: -1},
    function: launchGraphiQLServer,
  }
}

export const launchGraphiQLServer: DevProcessFunction<GraphiQLServerProcessOptions> = async (
  {stdout, abortSignal},
  options: GraphiQLServerProcessOptions,
) => {
  const httpServer = setupGraphiQLServer({...options, stdout})
  abortSignal.addEventListener('abort', async () => {
    httpServer.close()
  })
}
