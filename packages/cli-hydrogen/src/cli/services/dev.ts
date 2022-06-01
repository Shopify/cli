import {createServer} from 'vite'

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

  await server.listen()
  server.printUrls()
  server.config.logger.info('')
}

export default dev
