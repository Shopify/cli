// eslint-disable-next-line import/extensions
import {fastifyHttpProxy} from './fastify-http-proxy/index.js'
import {port, output, error, fastify} from '@shopify/cli-kit'
import {Writable} from 'stream'

export interface ReverseHTTPProxyTarget {
  /** The prefix to include in the logs
   *   [vite] Output coming from Vite
   */
  logPrefix: string

  /**
   * The HTTP path prefix used to match against request and determine if the traffic should be
   * forwarded to this target
   */
  pathPrefix?: string
  /**
   * A callback to invoke the process. stdout and stderr should be used
   * to send standard output and error data that gets formatted with the
   * right prefix.
   */
  action: (stdout: Writable, stderr: Writable, signal: error.AbortSignal, port: number) => Promise<void> | void
}

/**
 * A convenient function that runs an HTTP server and does path-based traffic forwarding to sub-processes that run
 * an HTTP server. The method assigns a random port to each of the processes.
 * @param tunnelUrl {string} The URL of the tunnel.
 * @param portNumber {number} The port to use for the proxy HTTP server. When undefined, a random port is automatically assigned.
 * @param proxyTargets {ReverseHTTPProxyTarget[]} List of target processes to forward traffic to.
 * @param additionalProcesses {output.OutputProcess[]} Additional processes to run. The proxy won't forward traffic to these processes.
 * @returns {Promise<ReverseHTTPProxy>} A promise that resolves with an interface to get the port of the proxy and stop it.
 */
export async function runConcurrentHTTPProcessesAndPathForwardTraffic(
  tunnelUrl: string,
  portNumber: number | undefined = undefined,
  proxyTargets: ReverseHTTPProxyTarget[],
  additionalProcesses: output.OutputProcess[],
): Promise<void> {
  const server = fastify.fastify()
  const processes = await Promise.all(
    proxyTargets.map(async (target): Promise<output.OutputProcess> => {
      const targetPort = await port.getRandomPort()
      server.register(fastifyHttpProxy, {
        upstream: `http://localhost:${targetPort}`,
        prefix: target.pathPrefix,
        rewritePrefix: target.pathPrefix,
        http2: false,
        websocket: target.logPrefix === 'extensions',
        replyOptions: {
          // Update `host` header to be tunnelURL when forwarding to extensions binary.
          // The binary uses this to build extensions URLs and they must use the tunnelURL always.
          rewriteRequestHeaders: (_originalReq, headers) => {
            const host = tunnelUrl.replace(/^https?:\/\//, '')
            return {...headers, host}
          },
        },
      })
      return {
        prefix: target.logPrefix,
        action: async (stdout, stderr, signal) => {
          await target.action(stdout, stderr, signal, targetPort)
        },
      }
    }),
  )

  const availablePort = portNumber ?? (await port.getRandomPort())

  await Promise.all([
    output.concurrent([...processes, ...additionalProcesses], (abortSignal) => {
      abortSignal.addEventListener('abort', async () => {
        await server.close()
      })
    }),
    server.listen({
      port: availablePort,
    }),
  ])
}
