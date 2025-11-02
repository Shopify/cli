import {defaultQuery} from './templates/graphiql.js'
import {unauthorizedTemplate} from './templates/unauthorized.js'
import express from 'express'
import bodyParser from 'body-parser'
import {performActionWithRetryAfterRecovery} from '@shopify/cli-kit/common/retry'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {AbortError} from '@shopify/cli-kit/node/error'
import {adminUrl, supportedApiVersions} from '@shopify/cli-kit/node/api/admin'
import {fetch} from '@shopify/cli-kit/node/http'
import {renderLiquidTemplate} from '@shopify/cli-kit/node/liquid'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {readFile, findPathUp} from '@shopify/cli-kit/node/fs'
import {joinPath, moduleDirectory} from '@shopify/cli-kit/node/path'
import {Server} from 'http'
import {Writable} from 'stream'
import {createRequire} from 'module'

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
      const bodyData = {
        client_id: apiKey,
        client_secret: apiSecret,
        grant_type: 'client_credentials',
      }
      const tokenResponse = await fetch(`https://${storeFqdn}/admin/oauth/access_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyData),
      })

      const tokenJson = (await tokenResponse.json()) as {access_token: string}
      return tokenJson.access_token
    } catch (_error) {
      throw new TokenRefreshError()
    }
  }

  app.get('/graphiql/ping', corsMiddleware, (_req, res) => {
    res.send('pong')
  })

  // Serve static assets for the React app (JS, CSS, workers)
  const graphiqlIndexPath = require.resolve('@shopify/app/assets/graphiql/index.html')
  const graphiqlAssetsDir = graphiqlIndexPath.replace('/index.html', '')
  app.use('/extensions/graphiql/assets', express.static(joinPath(graphiqlAssetsDir, 'extensions', 'graphiql', 'assets')))
  app.use('/monacoeditorwork', express.static(joinPath(graphiqlAssetsDir, 'monacoeditorwork')))

  async function fetchApiVersionsWithTokenRefresh(): Promise<string[]> {
    return performActionWithRetryAfterRecovery(
      async () => supportedApiVersions({storeFqdn, token: await token()}),
      refreshToken,
    )
  }

  app.get('/graphiql/status', (_req, res) => {
    fetchApiVersionsWithTokenRefresh()
      .then(() => {
        res.send({
          status: 'OK',
          storeFqdn,
          appName,
          appUrl,
        })
      })
      .catch(() => res.send({status: 'UNAUTHENTICATED'}))
  })

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  app.get('/graphiql', async (req, res) => {
    outputDebug('Handling /graphiql request', stdout)
    if (failIfUnmatchedKey(req.query.key as string, res)) return

    const usesHttps = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https'
    const baseUrl = `http${usesHttps ? 's' : ''}://${req.get('host')}`

    let apiVersions: string[]
    try {
      apiVersions = await fetchApiVersionsWithTokenRefresh()
    } catch (err) {
      if (err instanceof TokenRefreshError) {
        return res.send(
          await renderLiquidTemplate(unauthorizedTemplate, {
            previewUrl: appUrl,
            url: baseUrl,
          }),
        )
      }
      throw err
    }

    const sortedVersions = apiVersions.sort().reverse()
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const apiVersion = sortedVersions[0]!

    function decodeQueryString(input: string | undefined) {
      return input ? decodeURIComponent(input).replace(/\n/g, '\\n') : undefined
    }

    const query = decodeQueryString(req.query.query as string)

    // Read the built React index.html
    const graphiqlAssetsDir = await findPathUp(joinPath('assets', 'graphiql'), {
      type: 'directory',
      cwd: moduleDirectory(import.meta.url),
    })

    if (!graphiqlAssetsDir) {
      return res.status(404).send('GraphiQL assets not found')
    }

    const indexHtmlPath = joinPath(graphiqlAssetsDir, 'index.html')
    let indexHtml = await readFile(indexHtmlPath)

    // Build config object to inject (never include apiSecret or tokens)
    const config = {
      apiVersion,
      apiVersions: [...apiVersions, 'unstable'],
      appName,
      appUrl,
      storeFqdn,
      baseUrl,
      key: key ?? undefined,
      defaultQuery: query ?? defaultQuery,
    }

    // Inject config script before </head>
    const configScript = `<script>window.__GRAPHIQL_CONFIG__ = ${JSON.stringify(config)};</script>`
    indexHtml = indexHtml.replace('</head>', `${configScript}\n  </head>`)

    res.setHeader('Content-Type', 'text/html')
    res.send(indexHtml)
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
  return app.listen(port, 'localhost', () => stdout.write(`GraphiQL server started on port ${port}`))
}
