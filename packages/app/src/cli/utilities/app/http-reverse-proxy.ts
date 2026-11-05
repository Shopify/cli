import {AbortController} from '@shopify/cli-kit/node/abort'
import {outputDebug, outputContent, outputToken, outputWarn} from '@shopify/cli-kit/node/output'
import {useConcurrentOutputContext} from '@shopify/cli-kit/node/ui/components'
import * as http from 'http'
import * as https from 'https'
import {Writable} from 'stream'
import type Server from 'http-proxy-node16'

function isAggregateError(err: Error): err is Error & {errors: Error[]} {
  return 'errors' in err && Array.isArray((err as {errors?: unknown}).errors)
}

export interface LocalhostCert {
  key: string
  cert: string
  certPath: string
}

export async function getProxyingWebServer(
  rules: {[key: string]: string},
  abortSignal: AbortController['signal'],
  localhostCert?: LocalhostCert,
  stdout?: Writable,
) {
  // Lazy-importing it because it's CJS and we don't want it
  // to block the loading of the ESM module graph.
  const httpProxy = await import('http-proxy-node16')
  const proxy = httpProxy.default.createProxyServer()
  proxy.on('proxyRes', handlePreflightResponse)

  const requestListener = getProxyServerRequestListener(rules, proxy, stdout)

  const server = localhostCert ? https.createServer(localhostCert, requestListener) : http.createServer(requestListener)

  // Capture websocket requests and forward them to the proxy
  server.on('upgrade', getProxyServerWebsocketUpgradeListener(rules, proxy, stdout))

  abortSignal.addEventListener('abort', () => {
    outputDebug('Closing reverse HTTP proxy')
    server.close()
  })
  return {server}
}

function getProxyServerWebsocketUpgradeListener(
  rules: {[key: string]: string},
  proxy: Server,
  stdout?: Writable,
): (req: http.IncomingMessage, socket: import('stream').Duplex, head: Buffer) => void {
  return function (req, socket, head) {
    const target = match(rules, req, true)
    if (target) {
      return proxy.ws(req, socket, head, {target}, (err) => {
        useConcurrentOutputContext({outputPrefix: 'proxy', stripAnsi: false}, () => {
          const lastError = isAggregateError(err) ? err.errors[err.errors.length - 1] : undefined
          const error = lastError ?? err
          outputWarn(`Error forwarding websocket request: ${error.message}`, stdout)
          outputWarn(`└  Unreachable target "${target}" for path: "${req.url}"`, stdout)
        })
      })
    }
    socket.destroy()
  }
}

function getProxyServerRequestListener(
  rules: {[key: string]: string},
  proxy: Server,
  stdout?: Writable,
): http.RequestListener | undefined {
  return function (req, res) {
    const target = match(rules, req)
    if (target) {
      return proxy.web(req, res, {target, selfHandleResponse: isPreflight(req)}, (err) => {
        useConcurrentOutputContext({outputPrefix: 'proxy', stripAnsi: false}, () => {
          const lastError = isAggregateError(err) ? err.errors[err.errors.length - 1] : undefined
          const error = lastError ?? err
          outputWarn(`Error forwarding web request: ${error.message}`, stdout)
          outputWarn(`└  Unreachable target "${target}" for path: "${req.url}"`, stdout)
        })
        if (isPreflight(req) && !res.headersSent) respondToPreflight(req, res)
      })
    }

    outputDebug(outputContent`
Reverse HTTP proxy error - Invalid path: ${req.url ?? ''}
These are the allowed paths:
${outputToken.json(JSON.stringify(rules))}
`)

    res.statusCode = 500
    res.end(`Invalid path ${req.url}`)
  }
}

// Headers that only apply to a single connection and must not be relayed when we write the response ourselves.
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

function isPreflight(req: http.IncomingMessage) {
  return req.method === 'OPTIONS'
}

/**
 * CORS preflights are answered by the target app, which is the only one that knows which origins to trust
 * (including whether to allow credentials).
 *
 * Dev servers that don't implement OPTIONS (4xx/5xx) or can't be reached get a response from the proxy instead,
 * reflecting the request. This also replaces a deliberate rejection from the target, which is acceptable for local
 * development. Credentials are never granted here, as that would authorize any origin.
 */
function handlePreflightResponse(
  targetResponse: http.IncomingMessage,
  req: http.IncomingMessage,
  res: http.ServerResponse,
) {
  if (!isPreflight(req)) return

  const statusCode = targetResponse.statusCode ?? 500
  if (statusCode >= 400) {
    targetResponse.resume()
    respondToPreflight(req, res)
    return
  }

  const headers = Object.fromEntries(
    Object.entries(targetResponse.headers).filter(([name]) => !HOP_BY_HOP_HEADERS.has(name)),
  )
  res.writeHead(statusCode, headers)
  targetResponse.on('error', () => res.destroy())
  targetResponse.pipe(res)
}

function respondToPreflight(req: http.IncomingMessage, res: http.ServerResponse) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': req.headers.origin ?? '*',
    'Access-Control-Allow-Methods':
      req.headers['access-control-request-method'] ?? 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] ?? 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  })
  res.end()
}

function match(rules: {[key: string]: string}, req: http.IncomingMessage, websocket = false) {
  const path: string = req.url ?? '/'

  for (const pathPrefix in rules) {
    if (path.startsWith(pathPrefix)) return rules[pathPrefix]
  }

  if (websocket && rules.websocket) return rules.websocket

  return rules.default
}
