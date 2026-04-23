import {defaultQuery, graphiqlTemplate} from './templates/graphiql.js'
import {unauthorizedTemplate} from './templates/unauthorized.js'
import {filterCustomHeaders} from './utilities.js'
import {performActionWithRetryAfterRecovery} from '../../common/retry.js'
import {CLI_KIT_VERSION} from '../../common/version.js'
import {AbortError} from '../error.js'
import {adminUrl, supportedApiVersions} from '../api/admin.js'
import {fetch} from '../http.js'
import {renderLiquidTemplate} from '../liquid.js'
import {outputDebug} from '../output.js'
import {containsMutation} from '../graphql.js'
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
import {createHmac, randomBytes} from 'crypto'
import {createServer, Server} from 'http'
import {readFileSync} from 'fs'
import {Writable} from 'stream'
import {createRequire} from 'module'

/**
 * Derives a deterministic GraphiQL authentication key from the app's API secret and store FQDN.
 * The key is stable across dev server restarts (so browser tabs survive restarts)
 * but is not guessable without the app secret.
 *
 * @param apiSecret - The Partners app's client secret used as the HMAC key.
 * @param storeFqdn - The myshopify.com domain the GraphiQL session targets.
 * @returns A 64-character hex string suitable for use as the `?key=` query param.
 */
export function deriveGraphiQLKey(apiSecret: string, storeFqdn: string): string {
  return createHmac('sha256', apiSecret).update(`graphiql:${storeFqdn}`).digest('hex')
}

/**
 * Resolves the GraphiQL authentication key. Uses the explicitly provided key
 * if non-empty, otherwise derives one deterministically from the app secret.
 *
 * @param providedKey - An explicit key supplied by the caller; takes precedence when non-empty.
 * @param apiSecret - The Partners app's client secret, used to derive a stable key as a fallback.
 * @param storeFqdn - The myshopify.com domain the GraphiQL session targets.
 * @returns The resolved key.
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

/**
 * Pluggable strategy for obtaining and refreshing the Admin API access token
 * that the GraphiQL proxy injects into every request.
 *
 * - `getToken` may return a cached token; the proxy calls it for every request.
 * - `refreshToken` (optional) is invoked when the upstream Admin API returns 401.
 * When omitted, the proxy falls back to calling `getToken` again on 401.
 *
 * Implementations must throw `TokenRefreshError` (or any thrown error) when the
 * token cannot be obtained; the proxy renders the unauthorized template in that case.
 */
export interface TokenProvider {
  getToken: () => Promise<string>
  refreshToken?: () => Promise<string>
}

/**
 * Optional app-specific context, used to render the app pill and scopes note in the
 * GraphiQL header and to drive the deterministic key derivation. Pass when the GraphiQL
 * server is hosted as part of `shopify app dev`; omit for app-less use cases such as
 * `shopify store execute`.
 */
export interface GraphiQLAppContext {
  appName: string
  appUrl: string
  apiSecret: string
}

export interface SetupGraphiQLServerOptions {
  stdout: Writable
  port: number
  storeFqdn: string
  tokenProvider: TokenProvider
  /**
   * Authentication key required as a `?key=` query string on every request. When omitted:
   * - if `appContext` is provided, derived deterministically from `apiSecret` + `storeFqdn`
   * so browser tabs survive dev server restarts.
   * - otherwise, generated randomly per process.
   */
  key?: string
  appContext?: GraphiQLAppContext
  /**
   * When true, the proxy rejects mutation operations with HTTP 400 before forwarding
   * them to the Admin API. Use this to mirror non-interactive safety guarantees in the
   * interactive UI.
   */
  protectMutations?: boolean
}

const MUTATIONS_BLOCKED_MESSAGE = 'Mutations are disabled. Re-run with --allow-mutations to enable mutations.'

/**
 * Starts a local HTTP server that hosts the GraphiQL UI and proxies requests to the
 * Admin API for the configured store. Authentication is delegated to the supplied
 * `tokenProvider`, so the same server can serve both `shopify app dev` and stored-session
 * use cases.
 *
 * @param options - Configuration for the server, including the target store, the
 * pluggable token provider, and the local port to bind to.
 * @returns The underlying Node `http.Server` instance, already listening on `options.port`.
 */
export function setupGraphiQLServer(options: SetupGraphiQLServerOptions): Server {
  const {stdout, port, storeFqdn, tokenProvider, key: providedKey, appContext, protectMutations = false} = options
  const key = resolveGraphiQLServerKey(providedKey, appContext, storeFqdn)
  outputDebug(`Setting up GraphiQL HTTP server on port ${port}...`, stdout)

  const app = createApp()
  const router = createRouter()

  const refreshUpstreamToken = async (): Promise<string> => {
    try {
      outputDebug('refreshing token', stdout)
      return await (tokenProvider.refreshToken ?? tokenProvider.getToken)()
    } catch (_error) {
      throw new TokenRefreshError()
    }
  }

  const currentToken = async (): Promise<string> => {
    try {
      return await tokenProvider.getToken()
    } catch (_error) {
      throw new TokenRefreshError()
    }
  }

  async function fetchApiVersionsWithTokenRefresh(): Promise<string[]> {
    return performActionWithRetryAfterRecovery(
      async () => supportedApiVersions({storeFqdn, token: await currentToken()}),
      refreshUpstreamToken,
    )
  }

  const faviconPath = require.resolve('@shopify/cli-kit/assets/graphiql/favicon.ico')
  const faviconContent = readFileSync(faviconPath)
  const stylePath = require.resolve('@shopify/cli-kit/assets/graphiql/style.css')
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
        return {status: 'OK', storeFqdn, appName: appContext?.appName, appUrl: appContext?.appUrl}
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
            previewUrl: appContext?.appUrl ?? '',
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
          appName: appContext?.appName,
          appUrl: appContext?.appUrl,
          key,
          storeFqdn,
          protectMutations,
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

        if (protectMutations && isMutationRequestBody(body)) {
          setResponseStatus(event, 400)
          return {errors: [{message: MUTATIONS_BLOCKED_MESSAGE}]}
        }

        const reqBody = JSON.stringify(body)

        const reqHeaders = getRequestHeaders(event)
        const customHeaders = filterCustomHeaders(reqHeaders)

        const runRequest = async (token: string) => {
          const headers = {
            ...customHeaders,
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': token,
            'User-Agent': `ShopifyCLIGraphiQL/${CLI_KIT_VERSION}`,
          }

          return fetch(graphqlUrl, {
            method: 'POST',
            headers,
            body: reqBody,
          })
        }

        let result = await runRequest(await currentToken())
        if (result.status === 401) {
          outputDebug('Token expired, fetching new token', stdout)
          result = await runRequest(await refreshUpstreamToken())
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

// Picks the right key based on what the caller supplied:
// - explicit non-empty key → use it
// - app context with apiSecret → derive deterministically (stable across restarts)
// - otherwise → random per-process key (browser tabs won't survive restarts, which is
//   the right tradeoff when there's no stable secret to derive from).
function resolveGraphiQLServerKey(
  providedKey: string | undefined,
  appContext: GraphiQLAppContext | undefined,
  storeFqdn: string,
): string {
  const trimmed = providedKey?.trim()
  if (trimmed) return trimmed
  if (appContext) return deriveGraphiQLKey(appContext.apiSecret, storeFqdn)
  return randomBytes(32).toString('hex')
}

function isMutationRequestBody(body: unknown): boolean {
  if (typeof body !== 'object' || body === null) return false
  const {query, operationName} = body as {query?: unknown; operationName?: unknown}
  if (typeof query !== 'string') return false
  return containsMutation(query, typeof operationName === 'string' ? operationName : undefined)
}
