import {defaultQuery, graphiqlTemplate} from './templates/graphiql.js'
import {unauthorizedTemplate} from './templates/unauthorized.js'
import {filterCustomHeaders} from './utilities.js'
import {
  createApp,
  createRouter,
  defineEventHandler,
  getQuery,
  getRequestHeader,
  getRequestHeaders,
  readBody,
  setResponseHeader,
  setResponseStatus,
  toNodeListener,
} from 'h3'
import {performActionWithRetryAfterRecovery} from '@shopify/cli-kit/common/retry'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {AbortError} from '@shopify/cli-kit/node/error'
import {adminUrl, supportedApiVersions} from '@shopify/cli-kit/node/api/admin'
import {fetch} from '@shopify/cli-kit/node/http'
import {renderLiquidTemplate} from '@shopify/cli-kit/node/liquid'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {createHmac} from 'crypto'
import {createServer, Server} from 'http'
import {readFileSync} from 'fs'
import {Writable} from 'stream'
import {createRequire} from 'module'

/**
 * Derives a deterministic GraphiQL authentication key from the app's API secret and store FQDN.
 * The key is stable across dev server restarts (so browser tabs survive restarts)
 * but is not guessable without the app secret.
 */
export function deriveGraphiQLKey(apiSecret: string, storeFqdn: string): string {
  return createHmac('sha256', apiSecret).update(`graphiql:${storeFqdn}`).digest('hex')
}

/**
 * Resolves the GraphiQL authentication key. Uses the explicitly provided key
 * if non-empty, otherwise derives one deterministically from the app secret.
 */
export function resolveGraphiQLKey(providedKey: string | undefined, apiSecret: string, storeFqdn: string): string {
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- intentional: empty string after trim should fall through to deriveGraphiQLKey
  return providedKey?.trim() || deriveGraphiQLKey(apiSecret, storeFqdn)
}

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
  key: providedKey,
  storeFqdn,
}: SetupGraphiQLServerOptions): Server {
  // Always require an authentication key. If not explicitly provided, derive one
  // deterministically from apiSecret + storeFqdn so the key is stable across restarts
  // (browser tabs survive dev server restarts) but not guessable without the app secret.
  const key = resolveGraphiQLKey(providedKey, apiSecret, storeFqdn)
  outputDebug(`Setting up GraphiQL HTTP server on port ${port}...`, stdout)

  const app = createApp()
  const router = createRouter()

  let _token: string | undefined
  async function token(): Promise<string> {
    // eslint-disable-next-line require-atomic-updates
    _token ??= await refreshToken()
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

  async function fetchApiVersionsWithTokenRefresh(): Promise<string[]> {
    return performActionWithRetryAfterRecovery(
      async () => supportedApiVersions({storeFqdn, token: await token()}),
      refreshToken,
    )
  }

  const faviconPath = require.resolve('@shopify/app/assets/graphiql/favicon.ico')
  const faviconContent = readFileSync(faviconPath)
  const stylePath = require.resolve('@shopify/app/assets/graphiql/style.css')
  const styleContent = readFileSync(stylePath, 'utf8')

  app.use(
    defineEventHandler((event) => {
      setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
      setResponseHeader(event, 'Access-Control-Allow-Methods', 'GET, OPTIONS')
      setResponseHeader(
        event,
        'Access-Control-Allow-Headers',
        'Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, ngrok-skip-browser-warning',
      )
    }),
  )

  router.get(
    '/graphiql/ping',
    defineEventHandler(() => 'pong'),
  )

  router.get(
    '/graphiql/favicon.ico',
    defineEventHandler((event) => {
      setResponseHeader(event, 'Content-Type', 'image/x-icon')
      return faviconContent
    }),
  )

  router.get(
    '/graphiql/simple.css',
    defineEventHandler((event) => {
      setResponseHeader(event, 'Content-Type', 'text/css')
      return styleContent
    }),
  )

  router.get(
    '/graphiql/status',
    defineEventHandler(async () => {
      try {
        await fetchApiVersionsWithTokenRefresh()
        return {status: 'OK', storeFqdn, appName, appUrl}
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch {
        return {status: 'UNAUTHENTICATED'}
      }
    }),
  )

  router.get(
    '/graphiql',
    defineEventHandler(async (event) => {
      outputDebug('Handling /graphiql request', stdout)

      const query = getQuery(event)

      if (key && query.key !== key) {
        setResponseStatus(event, 404)
        return `Invalid path ${event.path}`
      }

      const forwardedProto = getRequestHeader(event, 'x-forwarded-proto')
      const usesHttps = forwardedProto === 'https'
      const host = getRequestHeader(event, 'host')
      const url = `http${usesHttps ? 's' : ''}://${host}`

      let apiVersions: string[]
      try {
        apiVersions = await fetchApiVersionsWithTokenRefresh()
      } catch (err) {
        if (err instanceof TokenRefreshError) {
          return renderLiquidTemplate(unauthorizedTemplate, {
            previewUrl: appUrl,
            url,
          })
        }
        throw err
      }

      const apiVersion = apiVersions.sort().reverse()[0]!

      function decodeQueryString(input: string | undefined) {
        return input ? decodeURIComponent(input).replace(/\n/g, '\\n') : undefined
      }

      const queryParam = decodeQueryString(query.query as string | undefined)
      const variables = decodeQueryString(query.variables as string | undefined)

      return renderLiquidTemplate(
        graphiqlTemplate({
          apiVersion,
          apiVersions: [...apiVersions, 'unstable'],
          appName,
          appUrl,
          key,
          storeFqdn,
        }),
        {
          url,
          defaultQueries: [{query: defaultQuery}],
          query: queryParam ? JSON.stringify(queryParam) : undefined,
          variables: variables ? JSON.stringify(variables) : undefined,
        },
      )
    }),
  )

  router.post(
    '/graphiql/graphql.json',
    defineEventHandler(async (event) => {
      outputDebug('Handling /graphiql/graphql.json request', stdout)

      const query = getQuery(event)

      if (key && query.key !== key) {
        setResponseStatus(event, 404)
        return `Invalid path ${event.path}`
      }

      const graphqlUrl = adminUrl(storeFqdn, query.api_version as string)
      try {
        const body = await readBody(event)
        const reqBody = JSON.stringify(body)

        const reqHeaders = getRequestHeaders(event)
        const customHeaders = filterCustomHeaders(reqHeaders)

        const runRequest = async () => {
          const headers = {
            ...customHeaders,
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': await token(),
            'User-Agent': `ShopifyCLIGraphiQL/${CLI_KIT_VERSION}`,
          }

          return fetch(graphqlUrl, {
            method: 'POST',
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

        setResponseHeader(event, 'Content-Type', 'application/json')
        setResponseStatus(event, result.status)
        return result.json()
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch (error: unknown) {
        setResponseStatus(event, 500)
        if (error instanceof Error) {
          return {errors: [error.message]}
        }
        return {errors: ['Unknown error']}
      }
    }),
  )

  app.use(router)

  const server = createServer(toNodeListener(app))
  server.listen(port, 'localhost', () => stdout.write(`GraphiQL server started on port ${port}`))
  return server
}
