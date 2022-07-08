import {ensureDevEnvironment} from './environment.js'
import {HydrogenApp} from '../models/app.js'
import {generateURL} from '../../services/dev/urls.js'
import {buildAppURL} from '../../services/dev/output.js'
import {error, session, port, output} from '@shopify/cli-kit'
import {Config} from '@oclif/core'
import {createServer} from 'vite'
import express from 'express'
import {Shopify, ApiVersion} from '@shopify/shopify-api'

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
    identifiers,
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
    apiKey: identifiers.app,
    apiSecret: apiSecret as string,
    storeFqdn,
  })
}

type StartServerOptions = Omit<DevOptions, 'tunnelUrl'> & {
  url: string
  apiKey: string
  localPort: number
  apiSecret: string
}

async function startServer(options: StartServerOptions) {
  const activeShopifyShops: {[key: string]: string} = {}

  initializeShopifyAPI(options)

  const server = express()
  server.set('top-level-oauth-cookie', 'shopify_top_level_oauth')
  server.set('active-shopify-shops', activeShopifyShops)
  server.set('use-online-tokens', true)

  Shopify.Webhooks.Registry.addHandler('APP_UNINSTALLED', {
    path: '/api/webhooks',
    webhookHandler: async (topic, shop, body) => {
      await delete activeShopifyShops[shop]
    },
  })

  addMiddlewares(server, options)

  // Vite
  const vite = await createViteServer(options)
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

async function addMiddlewares(server: ReturnType<typeof express>, options: StartServerOptions) {
  server.post('/api/graphql', async (req, res) => {
    try {
      const response = await Shopify.Utils.graphqlProxy(req, res)
      res.status(200).send(response.body)
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res.status(500).send((error as any).message)
    }
  })

  server.use(express.json())

  server.use((req, res, next) => {
    const shop = req.query.shop
    if (Shopify.Context.IS_EMBEDDED_APP && shop) {
      res.setHeader('Content-Security-Policy', `frame-ancestors https://${shop} https://admin.shopify.com;`)
    } else {
      res.setHeader('Content-Security-Policy', `frame-ancestors 'none';`)
    }
    next()
  })

  server.use('/*', async (req, res, next) => {
    const shop = req.query.shop as string

    // Detect whether we need to reinstall the app, any request from Shopify will
    // include a shop in the query parameters.
    if (server.get('active-shopify-shops')[shop] === undefined && shop) {
      res.redirect(`/api/auth?shop=${shop}`)
    } else {
      const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
        </head>
        <body>
          <div id="app"><!--index.jsx injects App.jsx here--></div>
          <script type="module" src="/index.jsx"></script>
        </body>
      </html>
      `
      res.status(200).set('Content-Type', 'text/html').send(html)
    }
  })
}

function initializeShopifyAPI(options: StartServerOptions) {
  Shopify.Context.initialize({
    API_KEY: options.apiKey,
    API_SECRET_KEY: options.apiSecret,
    SCOPES: options.app.configuration.scopes,
    HOST_NAME: options.url.replace(/https?:\/\//, ''),
    HOST_SCHEME: options.url.split('://')[0],
    API_VERSION: ApiVersion.April22,
    IS_EMBEDDED_APP: true,
  })
}

async function createViteServer(options: StartServerOptions) {
  return createServer({
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
}

export default dev
