import {createServer} from 'vite'

interface DevOptions {
  directory: string
}

async function dev({directory}: DevOptions) {
  await runHydrogen({directory})
}

async function runHydrogen({directory}: {directory: string}) {
  const server = await createServer({
    root: directory,
    server: {
      open: true,
    },
  })

  await server.listen()
  server.printUrls()
}

export default dev
