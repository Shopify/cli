import {ensureDevEnvironment} from './environment.js'
import {HydrogenApp} from '../models/app.js'
import {generateURL} from '../../services/dev/urls.js'
import {buildAppURL} from '../../services/dev/output.js'
import {error, session, port, output} from '@shopify/cli-kit'
import {Config} from '@oclif/core'
import {createServer} from 'vite'
import express from 'express'

export interface DevOptions {
  app: HydrogenApp
  apiKey?: string
  storeFqdn?: string
  reset: boolean
  update: boolean
  commandConfig: Config
  tunnelUrl?: string
}

async function dev(options: DevOptions) {
  const token = await session.ensureAuthenticatedPartners()
  const {
    storeFqdn,
    app: {apiSecret},
  } = await ensureDevEnvironment(options, token)

  let localPort: number
  let url: string
  if (options.tunnelUrl) {
    const matches = options.tunnelUrl.match(/(https:\/\/[^:]+):([0-9]+)/)
    if (!matches) {
      throw new error.Abort(`Invalid tunnel URL: ${options.tunnelUrl}`, 'Valid format: "https://my-tunnel-url:port"')
    }
    localPort = Number(matches[2])
    url = matches[1]
  } else {
    localPort = await port.getRandomPort()
    url = await generateURL(options.commandConfig.plugins, localPort)
  }

  await startServer({
    ...options,
    url,
    localPort,
    apiSecret: apiSecret as string,
    storeFqdn,
  })
}

type StartServerOptions = Omit<DevOptions, 'tunnelUrl'> & {
  url: string
  localPort: number
  apiSecret: string
}

async function startServer(options: StartServerOptions) {
  const server = express()
  const vite = await createServer({
    root: options.app.directory,
    cacheDir: undefined,
    server: {
      middlewareMode: 'ssr',
    },
    clearScreen: false,
    optimizeDeps: {
      entries: [],
    },
    plugins: [
      {
        name: 'config-watch',
        handleHotUpdate: async (context) => {
          // const watcherKey = Object.keys(watchers).find((pathPrefix) => context.file.startsWith(pathPrefix))
          // if (!watcherKey) {
          //   return context.modules
          // }
          // await watchers[watcherKey](context.file)
          // return context.modules
        },
      },
    ],
  })
  server.use(vite.middlewares)
  server.listen(() => {
    const appURL = buildAppURL(options.storeFqdn as string, options.url)
    const heading = output.token.heading('App URL')
    const message = output.stringifyMessage(
      output.content`Your app's is available ${output.token.link('here', appURL)}`,
    )
    output.info(output.content`${heading}\n${message}\n`)
  })
}

export default dev
