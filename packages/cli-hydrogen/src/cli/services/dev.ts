import {createServer, ViteDevServer} from 'vite'
import {error as kitError} from '@shopify/cli-kit'

interface DevOptions {
  directory: string
  force: boolean
  host: boolean
}

async function dev({directory, force, host}: DevOptions) {
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
