import {BaseProcess, DevProcessFunction} from './types.js'
import {setupGraphiQLServer} from '../graphiql/server.js'

interface GraphiQLServerProcessOptions {
  appName: string
  apiKey: string
  apiSecret: string
  storeFqdn: string
  url: string
  port: number
  scopes: string[]
}

export interface GraphiQLServerProcess extends BaseProcess<GraphiQLServerProcessOptions> {
  type: 'graphiql'
}

export async function setupGraphiQLServerProcess(
  options: Omit<GraphiQLServerProcessOptions, 'port'>,
): Promise<GraphiQLServerProcess> {
  return {
    type: 'graphiql',
    prefix: '/graphiql',
    options: {...options, port: -1},
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
