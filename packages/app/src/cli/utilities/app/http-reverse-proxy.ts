import {AbortController} from '@shopify/cli-kit/node/abort'
import {outputDebug, outputContent, outputToken, outputWarn} from '@shopify/cli-kit/node/output'
import Server from 'http-proxy'
import * as http from 'http'
import * as https from 'https'

export interface LocalhostCert {
  key: string
  cert: string
}

export async function getProxyingWebServer(
  rules: {[key: string]: string},
  abortSignal: AbortController['signal'],
  localhostCert?: LocalhostCert,
) {
  // Lazy-importing it because it's CJS and we don't want it
  // to block the loading of the ESM module graph.
  const {default: httpProxy} = await import('http-proxy')
  const proxy = httpProxy.createProxy()

  const requestListener = getProxyServerRequestListener(rules, proxy)

  const server = localhostCert ? https.createServer(localhostCert, requestListener) : http.createServer(requestListener)

  // Capture websocket requests and forward them to the proxy
  server.on('upgrade', getProxyServerWebsocketUpgradeListener(rules, proxy))

  abortSignal.addEventListener('abort', () => {
    outputDebug('Closing reverse HTTP proxy')
    server.close()
  })
  return {server}
}

function getProxyServerWebsocketUpgradeListener(
  rules: {[key: string]: string},
  proxy: Server,
): (req: http.IncomingMessage, socket: import('stream').Duplex, head: Buffer) => void {
  return function (req, socket, head) {
    const target = match(rules, req, true)
    if (target) {
      return proxy.ws(req, socket, head, {target}, (err) => {
        outputWarn(`Error forwarding websocket request: ${err}`)
      })
    }
    socket.destroy()
  }
}

function getProxyServerRequestListener(
  rules: {[key: string]: string},
  proxy: Server,
): http.RequestListener | undefined {
  return function (req, res) {
    const target = match(rules, req)
    if (target) {
      return proxy.web(req, res, {target}, (err) => {
        outputWarn(`Error forwarding web request: ${err}`)
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
