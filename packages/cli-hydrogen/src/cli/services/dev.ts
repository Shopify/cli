import {createServer, ViteDevServer} from 'vite'
import {analytics, error as kitError} from '@shopify/cli-kit'
import {Config} from '@oclif/core'

interface DevOptions {
  directory: string
  force: boolean
  host: boolean
  commandConfig: Config
}

async function dev({directory, force, host, commandConfig}: DevOptions) {
  try {
    const server = await createServer({
      root: directory,
      server: {
        open: true,
        force,
        host,
      },
    })
    await server.listen()
    server.printUrls()
    server.config.logger.info('')
    await analytics.reportEvent({config: commandConfig})
    await closeEvent(server)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const abortError = new kitError.Abort(error.message)
    abortError.stack = error.stack
    throw abortError
  }
}

function closeEvent(server: ViteDevServer): Promise<void> {
  return new Promise((resolve) => {
    server.ws.on('close', () => {
      return resolve()
    })
  })
}

export default dev
