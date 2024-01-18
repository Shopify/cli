import {defaultQuery, graphiqlTemplate} from './templates/graphiql.js'
import {unauthorizedTemplate} from './templates/unauthorized.js'
import express from 'express'
import bodyParser from 'body-parser'
import {performActionWithRetryAfterRecovery} from '@shopify/cli-kit/common/retry'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {AbortError} from '@shopify/cli-kit/node/error'
import {adminUrl, supportedApiVersions} from '@shopify/cli-kit/node/api/admin'
import {fetch} from '@shopify/cli-kit/node/http'
import {renderLiquidTemplate} from '@shopify/cli-kit/node/liquid'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {encode as queryStringEncode} from 'node:querystring'
import {Server} from 'http'
import {Writable} from 'stream'
import {fileURLToPath} from 'url'
import {createRequire} from 'node:module'

const require = createRequire(import.meta.url)

class TokenRefreshError extends AbortError {
  constructor() {
    super('Failed to refresh credentials. Check that your app is installed, and try again.')
  }
}

interface SetupGraphiQLServerOptions {
  stdout: Writable
  port: number
  appName: string
  appUrl: string
  apiKey: string
  apiSecret: string
  key?: string
  storeFqdn: string
}

export function setupGraphiQLServer({
  stdout,
  port,
  appName,
  appUrl,
  apiKey,
  apiSecret,
  key,
  storeFqdn,
}: SetupGraphiQLServerOptions): Server {
  outputDebug(`Setting up GraphiQL HTTP server on port ${port}...`, stdout)
  const localhostUrl = `http://localhost:${port}`

  const app = express()

  function failIfUnmatchedKey(str: string, res: express.Response): boolean {
    if (!key || str === key) return false
    res.status(404).send(`Invalid path ${res.req.originalUrl}`)
    return true
  }

  let _token: string | undefined
  async function token(): Promise<string> {
    if (!_token) {
      // eslint-disable-next-line require-atomic-updates
      _token = await refreshToken()
    }
    return _token
  }

  async function refreshToken(): Promise<string> {
    try {
      outputDebug('refreshing token', stdout)
      _token = undefined
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
      return tokenJson.access_token
    } catch (_error) {
      throw new TokenRefreshError()
    }
  }

  app.get('/graphiql/ping', (_req, res) => {
    res.send('pong')
  })

  const faviconPath = joinPath(dirname(fileURLToPath(import.meta.url)), '../../../../../assets/graphiql/favicon.ico')
  app.get('/graphiql/favicon.ico', (_req, res) => {
    res.sendFile(faviconPath)
  })

  const stylePath = require.resolve('@shopify/cli-kit/assets/style.css')
  app.get('/graphiql/simple.css', (_req, res) => {
    res.sendFile(stylePath)
  })

  async function fetchApiVersionsWithTokenRefresh(): Promise<string[]> {
    return performActionWithRetryAfterRecovery(
      async () => supportedApiVersions({storeFqdn, token: await token()}),
      refreshToken,
    )
  }

  app.get('/graphiql/status', (_req, res) => {
    fetchApiVersionsWithTokenRefresh()
      .then(() => res.send({status: 'OK', storeFqdn, appName, appUrl}))
      .catch(() => res.send({status: 'UNAUTHENTICATED'}))
  })

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  app.get('/graphiql', async (req, res) => {
    outputDebug('Handling /graphiql request', stdout)
    if (failIfUnmatchedKey(req.query.key as string, res)) return

    let apiVersions: string[]
    try {
      apiVersions = await fetchApiVersionsWithTokenRefresh()
    } catch (err) {
      if (err instanceof TokenRefreshError) {
        return res.send(
          await renderLiquidTemplate(unauthorizedTemplate, {
            previewUrl: appUrl,
            url: localhostUrl,
          }),
        )
      }
      throw err
    }

    const apiVersion = apiVersions.sort().reverse()[0]!

    res.send(
      await renderLiquidTemplate(
        graphiqlTemplate({
          apiVersion,
          apiVersions: [...apiVersions, 'unstable'],
          appName,
          appUrl,
          key,
          storeFqdn,
        }),
        {
          url: localhostUrl,
          defaultQueries: [{query: defaultQuery}],
        },
      ),
    )
  })

  app.use(bodyParser.json())

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  app.post('/graphiql/graphql.json', async (req, res) => {
    outputDebug('Handling /graphiql/graphql.json request', stdout)
    if (failIfUnmatchedKey(req.query.key as string, res)) return

    const graphqlUrl = adminUrl(storeFqdn, req.query.api_version as string)
    try {
      const reqBody = JSON.stringify(req.body)

      const runRequest = async () => {
        const headers = {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': await token(),
          'User-Agent': `ShopifyCLIGraphiQL/${CLI_KIT_VERSION}`,
        }

        return fetch(graphqlUrl, {
          method: req.method,
          headers,
          body: reqBody,
        })
      }

      let result = await runRequest()
      if (result.status === 401) {
        outputDebug('Token expired, fetching new token', stdout)
        await refreshToken()
        result = await runRequest()
      }

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
  return app.listen(port, () => stdout.write(`GraphiQL server started on port ${port}`))
}
