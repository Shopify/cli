import {createServer} from 'vite'

interface DevOptions {
  directory: string
  force: boolean
}

async function dev({directory, force}: DevOptions) {
  const server = await createServer({
    root: directory,
    server: {
      open: true,
      force,
    },
  })

  await server.listen()
  server.printUrls()
}

export default dev
