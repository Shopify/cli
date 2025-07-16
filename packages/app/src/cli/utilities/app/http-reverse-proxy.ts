import {AbortController} from '@shopify/cli-kit/node/abort'
import {outputDebug, outputContent, outputToken, outputWarn} from '@shopify/cli-kit/node/output'
import Server from 'http-proxy'
import {useConcurrentOutputContext} from '@shopify/cli-kit/node/ui/components'
import * as http from 'http'
import * as https from 'https'
import {Writable} from 'stream'

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
  const {default: httpProxy} = await import('http-proxy')
  const proxy = httpProxy.createProxy()

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
          const error = err instanceof AggregateError && err.errors.length > 0 ? err.errors[err.errors.length - 1] : err
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
      return proxy.web(req, res, {target}, (err) => {
        useConcurrentOutputContext({outputPrefix: 'proxy', stripAnsi: false}, () => {
          const error = err instanceof AggregateError && err.errors.length > 0 ? err.errors[err.errors.length - 1] : err
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
