import {BaseProcess} from './types.js'
import {setupGraphiQLServer} from '../graphiql/server.js'
import {AppInterface} from '../../../models/app/app.js'

interface GraphiQLServerProcessOptions {
  app: AppInterface
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
  options: GraphiQLServerProcessOptions,
): Promise<GraphiQLServerProcess | undefined> {
  if (!options.apiSecret) return

  const optionsWithDefiniteApiSecret = {
    ...options,
    apiSecret: options.apiSecret,
  }

  return {
    type: 'graphiql',
    prefix: '/graphiql',
    options: optionsWithDefiniteApiSecret,
    function: async ({stdout, stderr, abortSignal}, {port}: {port: number}) => {
      const httpServer = setupGraphiQLServer({...optionsWithDefiniteApiSecret, stdout})
      abortSignal.addEventListener('abort', async () => {
        await httpServer.close()
      })
    },
  }
}
