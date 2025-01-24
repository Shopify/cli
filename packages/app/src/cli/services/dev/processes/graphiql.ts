import {BaseProcess, DevProcessFunction} from './types.js'
import {setupGraphiQLServer} from '../graphiql/server.js'

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

const launchGraphiQLServer: DevProcessFunction<GraphiQLServerProcessOptions> = async (
  {stdout, abortSignal},
  options: GraphiQLServerProcessOptions,
) => {
  const httpServer = setupGraphiQLServer({...options, stdout})
  abortSignal.addEventListener('abort', async () => {
    httpServer.close()
  })
}
