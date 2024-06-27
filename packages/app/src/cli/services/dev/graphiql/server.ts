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
import {outputDebug, outputInfo} from '@shopify/cli-kit/node/output'
import {encode as queryStringEncode} from 'node:querystring'
import {Server} from 'http'
import {Writable} from 'stream'
import {createRequire} from 'module'
import {EventEmitter} from 'node:stream'

const require = createRequire(import.meta.url)

class TokenRefreshError extends AbortError {
  constructor() {
    super('Failed to refresh credentials. Check that your app is installed, and try again.')
  }
}

function corsMiddleware(_req: express.Request, res: express.Response, next: (err?: Error) => unknown) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, ngrok-skip-browser-warning',
  )
  next()
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
  accessChangeEvent: EventEmitter
  initialExpectedScopes: string
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
  accessChangeEvent,
  initialExpectedScopes,
}: SetupGraphiQLServerOptions): Server {
  outputDebug(`Setting up GraphiQL HTTP server on port ${port}...`, stdout)
  const localhostUrl = `http://localhost:${port}`
  let expectedScopes = initialExpectedScopes

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

  let scopeMismatch = false

  async function refreshToken(expectedScopesBasedOnFile?: string): Promise<string> {
    if (expectedScopesBasedOnFile !== undefined) {
      expectedScopes = expectedScopesBasedOnFile
    }
    try {
      outputInfo('refreshing token', stdout)
      _token = undefined
      const oauthOptions = {
        client_id: apiKey,
        client_secret: apiSecret,
        grant_type: 'client_credentials',
        scope: expectedScopesBasedOnFile,
      }
      const queryString = queryStringEncode(oauthOptions)
      const tokenResponse = await fetch(`https://${storeFqdn}/admin/oauth/access_token?${queryString}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      const tokenResponseObject = await tokenResponse.json()
      console.log(tokenResponseObject)

      const {scope: approvedScopes} = tokenResponseObject as {scope: string}

      // break and trim by commas put the approved scopes into a set
      const approvedScopesSet = new Set(approvedScopes.split(',').map((scope) => scope.trim()))
      // same for scopes
      const scopesSet = new Set(expectedScopes.split(',').map((scope) => scope.trim()))

      // if these sets don't match exactly... log something
      const areSetsEqual = (left: Set<string>, right: Set<string>) =>
        left.size === right.size && [...left].every((value) => right.has(value))
      if (areSetsEqual(approvedScopesSet, scopesSet)) {
        console.log('setting that scopes are ok')
        scopeMismatch = false
      } else {
        console.log('setting that scopes are mismatched')
        scopeMismatch = true
      }

      const tokenJson = tokenResponseObject as {access_token: string}
      return tokenJson.access_token
    } catch (_error) {
      throw new TokenRefreshError()
    }
  }

  accessChangeEvent.on('accessChange', ({scopes}) => {
    const hardRefresh = async () => {
      console.log(`Refreshing token due to file change, new expected scopes are ${scopes}`)
      _token = await refreshToken(scopes)
    }
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    hardRefresh()
  })

  app.get('/graphiql/ping', corsMiddleware, (_req, res) => {
    res.send('pong')
  })

  const faviconPath = require.resolve('@shopify/app/assets/graphiql/favicon.ico')
  app.get('/graphiql/favicon.ico', (_req, res) => {
    res.sendFile(faviconPath)
  })

  const stylePath = require.resolve('@shopify/cli-kit/assets/style.css')
  app.get('/graphiql/simple.css', (_req, res) => {
    res.sendFile(stylePath)
  })

  async function fetchApiVersionsWithTokenRefresh(): Promise<string[]> {
    _token = await refreshToken()
    return performActionWithRetryAfterRecovery(
      async () => supportedApiVersions({storeFqdn, token: await token()}),
      refreshToken,
    )
  }

  app.get('/graphiql/status', (_req, res) => {
    fetchApiVersionsWithTokenRefresh()
      .then(() => res.send({status: 'OK', storeFqdn, appName, appUrl, scopeMismatch}))
      .catch(() => res.send({status: 'UNAUTHENTICATED'}))
  })

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  app.get('/graphiql', async (req, res) => {
    outputDebug('Handling /graphiql request', stdout)

    if (failIfUnmatchedKey(req.query.key as string, res)) return

    let apiVersions: string[]
    try {
      await refreshToken()
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

    const query = req.query.query ? decodeURIComponent(req.query.query as string).replace(/\n/g, '\\n') : undefined

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
          appUrl,
          defaultQueries: [{query: defaultQuery}],
          query,
        },
      ),
    )
  })

  app.use(bodyParser.json())

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  app.post('/graphiql/graphql.json', async (req, res) => {
    // we always grab a fresh token in case scopes have changed
    await refreshToken()

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
