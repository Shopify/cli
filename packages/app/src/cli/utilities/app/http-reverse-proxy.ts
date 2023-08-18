import {renderDev} from '../../services/dev/ui.js'
import {getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {AbortController, AbortSignal} from '@shopify/cli-kit/node/abort'
import {OutputProcess, outputDebug, outputContent, outputToken, outputWarn} from '@shopify/cli-kit/node/output'
import {TunnelClient} from '@shopify/cli-kit/node/plugins/tunnel'
import {Writable} from 'stream'
import * as http from 'http'

export interface ReverseHTTPProxyTarget {
  /** The prefix to include in the logs
   *   [vite] Output coming from Vite
   */
  logPrefix: string

  /**
   * The port to use for the target HTTP server. When undefined, a random port is automatically assigned.
   */
  customPort?: number

  /**
   * The HTTP path prefix used to match against request and determine if the traffic should be
   * forwarded to this target
   */
  pathPrefix?: string

  /**
   * The configuration for a separate HMR server for this target.
   */
  hmrServer?: {
    port: number
    httpPaths: string[]
  }

  /**
   * A callback to invoke the process. stdout and stderr should be used
   * to send standard output and error data that gets formatted with the
   * right prefix.
   */
  action: (stdout: Writable, stderr: Writable, signal: AbortSignal, port: number) => Promise<void> | void
}

interface Options {
  previewUrl: string
  portNumber: number
  proxyTargets: ReverseHTTPProxyTarget[]
  additionalProcesses: OutputProcess[]
  app: {
    canEnablePreviewMode: boolean
    developmentStorePreviewEnabled?: boolean
    apiKey: string
    token: string
  }
  abortController?: AbortController
  tunnelClient?: TunnelClient
}

/**
 * A convenient function that runs an HTTP server and does path-based traffic forwarding to sub-processes that run
 * an HTTP server. The method assigns a random port to each of the processes.
 * @param tunnelUrl - The URL of the tunnel.
 * @param portNumber - The port to use for the proxy HTTP server. When undefined, a random port is automatically assigned.
 * @param proxyTargets - List of target processes to forward traffic to.
 * @param additionalProcesses - Additional processes to run. The proxy won't forward traffic to these processes.
 * @returns A promise that resolves with an interface to get the port of the proxy and stop it.
 */
export async function runConcurrentHTTPProcessesAndPathForwardTraffic({
  previewUrl,
  portNumber,
  proxyTargets,
  additionalProcesses,
  app,
  abortController,
  tunnelClient,
}: Options): Promise<void> {
  // Lazy-importing it because it's CJS and we don't want it
  // to block the loading of the ESM module graph.
  const {default: httpProxy} = await import('http-proxy')

  const rules: {[key: string]: string} = {}

  const processes = await Promise.all(
    proxyTargets.map(async (target): Promise<OutputProcess> => {
      const targetPort = target.customPort || (await getAvailableTCPPort())
      rules[target.pathPrefix ?? 'default'] = `http://localhost:${targetPort}`
      const hmrServer = target.hmrServer
      if (hmrServer) {
        rules.websocket = `http://localhost:${hmrServer.port}`
        hmrServer.httpPaths.forEach((path) => (rules[path] = `http://localhost:${hmrServer.port}`))
      }

      return {
        prefix: target.logPrefix,
        action: async (stdout, stderr, signal) => {
          await target.action(stdout, stderr, signal, targetPort)
        },
      }
    }),
  )

  outputDebug(outputContent`
Starting reverse HTTP proxy on port ${outputToken.raw(portNumber.toString())}
Routing traffic rules:
${outputToken.json(JSON.stringify(rules))}
`)

  const proxy = httpProxy.createProxy()
  const server = http.createServer(function (req, res) {
    const target = match(rules, req)
    if (target) {
      return proxy.web(req, res, {target}, (err) => {
        outputWarn(`Error forwarding web request: ${err}`)
      })
    }

    outputDebug(`
Reverse HTTP proxy error - Invalid path: ${req.url}
These are the allowed paths:
${outputToken.json(JSON.stringify(rules))}
`)

    res.statusCode = 500
    res.end(`Invalid path ${req.url}`)
  })

  // Capture websocket requests and forward them to the proxy
  server.on('upgrade', function (req, socket, head) {
    const target = match(rules, req, true)
    if (target) {
      return proxy.ws(req, socket, head, {target}, (err) => {
        outputWarn(`Error forwarding websocket request: ${err}`)
      })
    }
    socket.destroy()
  })

  const controller = abortController ?? new AbortController()

  controller.signal.addEventListener('abort', () => {
    outputDebug('Closing reverse HTTP proxy')
    server.close()
  })

  await Promise.all([
    renderDev({
      processes: [...processes, ...additionalProcesses],
      abortController: controller,
      previewUrl,
      app,
      tunnelClient,
    }),
    server.listen(portNumber),
  ])
}

function match(rules: {[key: string]: string}, req: http.IncomingMessage, websocket = false) {
  const path: string = req.url ?? '/'

  for (const pathPrefix in rules) {
    if (path.startsWith(pathPrefix)) return rules[pathPrefix]
  }

  if (websocket && rules.websocket) return rules.websocket

  return rules.default
}
