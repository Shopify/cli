import {defaultQuery, template} from './template.js'
import {urlNamespaces} from '../../../constants.js'
import express from 'express'
import bodyParser from 'body-parser'
import '@shopify/shopify-api/adapters/node'
import {LATEST_API_VERSION, ApiVersion} from '@shopify/shopify-api'
import {fetch} from '@shopify/cli-kit/node/http'
import {renderLiquidTemplate} from '@shopify/cli-kit/node/liquid'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {encode as queryStringEncode} from 'node:querystring'
import {Server} from 'http'
import {Writable} from 'stream'

interface SetupGraphiQLServerOptions {
  stdout: Writable
  port: number
  appName: string
  appUrl: string
  apiKey: string
  apiSecret: string
  url: string
  storeFqdn: string
  scopes: string[]
}

export function setupGraphiQLServer({
  stdout,
  port,
  appName,
  appUrl,
  apiKey,
  apiSecret,
  url,
  storeFqdn,
  scopes,
}: SetupGraphiQLServerOptions): Server {
  outputDebug(`Setting up GraphiQL HTTP server...`, stdout)

  const app = express()
    // Make the app accept all routes starting with /.shopify/xxx as /xxx
    .use((req, _res, next) => {
      if (req.path.startsWith(`/${urlNamespaces.devTools}`)) {
        req.url = req.url.replace(`/${urlNamespaces.devTools}`, '')
      }
      next()
    })

  let _token: string | undefined
  async function token(): Promise<string> {
    if (!_token) {
      outputDebug(`fetching token`, stdout)
      const queryString = queryStringEncode({
        client_id: apiKey,
        client_secret: apiSecret,
        grant_type: 'client_credentials',
      })
      const tokenResponse = await fetch(`https://${storeFqdn}/admin/oauth/access_token?${queryString}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      const tokenJson = (await tokenResponse.json()) as {access_token: string}
      outputDebug(`fetched token ${tokenJson.access_token}`, stdout)
      // eslint-disable-next-line require-atomic-updates
      _token = tokenJson.access_token
    }
    return _token
  }

  app.get('/graphiql/ping', (_req, res) => {
    res.send('pong')
  })

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  app.get('/graphiql', async (_req, res) => {
    outputDebug('Handling /graphiql request', stdout)
    res.send(
      await renderLiquidTemplate(template, {
        url: `https://${url}/${urlNamespaces.devTools}`,
        defaultQueries: [{query: defaultQuery}],
        apiVersion: LATEST_API_VERSION,
        storeFqdn,
        versions: Object.values(ApiVersion),
        appName,
        appUrl,
        scopes,
      }),
    )
  })

  app.use(bodyParser.json())

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  app.post('/graphiql/graphql.json', async (req, res) => {
    outputDebug('Handling /graphiql/graphql.json request', stdout)

    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': await token(),
    }

    const graphqlUrl = `https://${storeFqdn}/admin/api/${req.query.api_version ?? LATEST_API_VERSION}/graphql.json`
    try {
      const result = await fetch(graphqlUrl, {
        method: req.method,
        headers,
        body: JSON.stringify(req.body),
      })

      res.setHeader('Content-Type', 'application/json')
      res.statusCode = result.status
      const responseBody = await result.json()
      res.json(responseBody)
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error: unknown) {
      res.statusCode = 500
      if (error instanceof Error) {
        res.json({errors: [error.message]})
      } else {
        res.json({errors: ['Unknown error']})
      }
    }
    res.end()
  })
  return app.listen(port, () => stdout.write('GraphiQL server started'))
}
