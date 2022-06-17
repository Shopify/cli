import {createServer} from 'vite'
import {error} from '@shopify/cli-kit'

interface DevOptions {
  directory: string
  force: boolean
  host: boolean
}

async function dev({directory, force, host}: DevOptions) {
  const server = await createServer({
    root: directory,
    server: {
      open: true,
      force,
      host,
    },
  })

  try {
    await server.listen()
    server.printUrls()
    server.config.logger.info('')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (_error: any) {
    const abortError = new error.Abort(_error.message)
    abortError.stack = _error.stack
    throw abortError
  }
}

export default dev
