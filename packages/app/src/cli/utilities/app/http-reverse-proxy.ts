import {createProxyServer} from './http-proxy.js'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {outputDebug, outputContent, outputToken, outputWarn} from '@shopify/cli-kit/node/output'
import {useConcurrentOutputContext} from '@shopify/cli-kit/node/ui/components'
import * as http from 'http'
import * as https from 'https'
import {Writable} from 'stream'
import type {ProxyServer} from './http-proxy.js'

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
  const proxy = createProxyServer()

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
  proxy: ProxyServer,
  stdout?: Writable,
): (req: http.IncomingMessage, socket: import('stream').Duplex, head: Buffer) => void {
  return function (req, socket, head) {
    const target = match(rules, req, true)
    if (target) {
      return proxy.ws(req, socket as import('net').Socket, head, {target}, (err) => {
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
  proxy: ProxyServer,
  stdout?: Writable,
): http.RequestListener | undefined {
  return function (req, res) {
    const target = match(rules, req)
    if (target) {
      return proxy.web(req, res, {target}, (err) => {
        useConcurrentOutputContext({outputPrefix: 'proxy', stripAnsi: false}, () => {
          const lastError = isAggregateError(err) ? err.errors[err.errors.length - 1] : undefined
          const error = lastError ?? err
          outputWarn(`Error forwarding web request: ${error.message}`, stdout)
          outputWarn(`└  Unreachable target "${target}" for path: "${req.url}"`, stdout)
        })
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

function match(rules: {[key: string]: string}, req: http.IncomingMessage, websocket = false) {
  const path: string = req.url ?? '/'

  for (const pathPrefix in rules) {
    if (path.startsWith(pathPrefix)) return rules[pathPrefix]
  }

  if (websocket && rules.websocket) return rules.websocket

  return rules.default
}
