import {defaultQuery, template} from './template.js'
import express from 'express'
import bodyParser from 'body-parser'
import '@shopify/shopify-api/adapters/node'
import {shopifyApi, LogSeverity, Session, LATEST_API_VERSION} from '@shopify/shopify-api'
import {renderLiquidTemplate} from '@shopify/cli-kit/node/liquid'
import {outputDebug, outputInfo, outputWarn} from '@shopify/cli-kit/node/output'
import {Server} from 'http'
import {Writable} from 'stream'

function createShopify({
  stdout,
  apiKey,
  apiSecret,
  scopes,
  url,
  port,
}: {
  stdout: Writable
  apiKey: string
  apiSecret: string
  scopes: string[]
  url: string
  port: number
}) {
  return shopifyApi({
    apiKey,
    apiSecretKey: apiSecret,
    scopes,
    hostName: url,
    apiVersion: LATEST_API_VERSION,
    isEmbeddedApp: false,
    logger: {
      level: LogSeverity.Debug,
      timestamps: false,
      httpRequests: true,
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      log: async (severity, message) => {
        if (severity === LogSeverity.Debug) {
          outputDebug(message, stdout)
        } else if (severity === LogSeverity.Error || severity === LogSeverity.Warning) {
          outputWarn(message, stdout)
        } else {
          outputInfo(message, stdout)
        }
      },
    },
  })
}

interface SetupGraphiQLServerOptions {
  stdout: Writable
  port: number
  apiKey: string
  apiSecret: string
  url: string
  storeFqdn: string
  scopes: string[]
}

export function setupGraphiQLServer({
  stdout,
  port,
  apiKey,
  apiSecret,
  url,
  storeFqdn,
  scopes,
}: SetupGraphiQLServerOptions): Server {
  outputDebug(`Setting up GraphiQL HTTP server...`, stdout)

  const shopify = createShopify({stdout, apiKey, apiSecret, url, scopes, port})
  const app = express()
  let session: Session | undefined

  async function beginAuth(req: express.Request, res: express.Response) {
    stdout.write('Initiating OAuth flow...')
    await shopify.auth.begin({
      shop: shopify.utils.sanitizeShop(storeFqdn, true)!,
      callbackPath: '/graphiql/auth/callback',
      isOnline: false,
      rawRequest: req,
      rawResponse: res,
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  app.get('/graphiql/auth/callback', async (req, res) => {
    outputDebug('Handling /graphiql/auth/callback request', stdout)
    // The library will automatically set the appropriate HTTP headers
    const callback = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    })
    session = callback.session
    // You can now use callback.session to make API requests
    res.redirect('/graphiql')
  })
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  app.get('/graphiql', async (req, res) => {
    outputDebug('Handling /graphiql request', stdout)
    if (!session) {
      return beginAuth(req, res)
    }
    // const sessionId = await shopify.session.getCurrentId({
    // isOnline: false,
    // rawRequest: req,
    // rawResponse: res,
    // })
    // const session = await getSessionFromStorage(sessionId)
    res.send(
      await renderLiquidTemplate(template, {
        url: `https://${url}`,
        defaultQueries: [{query: defaultQuery}],
        apiVersion: LATEST_API_VERSION,
      }),
    )
  })
  app.use(bodyParser.json())
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  app.post('/graphiql/graphql.json', async (req, res) => {
    outputDebug('Handling /graphiql/graphql.json request', stdout)
    if (!session) {
      return beginAuth(req, res)
    }

    const client = new shopify.clients.Graphql({
      session,
      apiVersion: LATEST_API_VERSION,
    })
    const {body} = await client.query({data: req.body})
    res.json(body)
  })
  return app.listen(port, () => stdout.write('GraphiQL server started'))
}
