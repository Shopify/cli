import {createServer} from 'vite'
import {error as kitError} from '@shopify/cli-kit'

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
  } catch (error: any) {
    const abortError = new kitError.Abort(error.message)
    abortError.stack = error.stack
    throw abortError
  }
}

export default dev
