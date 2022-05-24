import fastifyHTTPProxy from './fastify-http-proxy/index.cjs'
import Fastify from 'fastify'
import {port, output} from '@shopify/cli-kit'
import {Writable} from 'stream'

/**
 * An interface that represents an instance of a reverse proxy.
 */
interface ReverseHTTPProxy {
  /**
   * The port the reverse proxy is running on.
   */
  port: number
  /**
   * Stops the reverse proxy.
   */
  close: () => Promise<void>
}

interface ReverseHTTPProxyTarget {
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
  action: (stdout: Writable, stderr: Writable, signal: AbortSignal, port: number) => Promise<void> | void
}

/**
 * A convenient function that runs an HTTP server and does path-based traffic forwarding to sub-processes that run
 * an HTTP server. The method assigns a random port to each of the processes.
 * @param portNumber {number} The port to use for the proxy HTTP server. When undefined, a random port is automatically assigned.
 * @param targets {ReverseHTTPProxyTarget[]} And list of processes that run HTTP servers.
 * @returns {Promise<ReverseHTTPProxy>} A promise that resolves with an interface to get the port of the proxy and stop it.
 */
export async function runConcurrentHTTPProcessesAndPathForwardTraffic(
  portNumber: number | undefined = undefined,
  targets: ReverseHTTPProxyTarget[],
): Promise<ReverseHTTPProxy> {
  const server = Fastify()

  const processes = await Promise.all(
    targets.map(async (target): Promise<output.OutputProcess> => {
      const targetPort = await port.getRandomPort()
      server.register(fastifyHTTPProxy, {
        upstream: `http://localhost:${targetPort}`,
        prefix: target.pathPrefix,
        rewritePrefix: target.pathPrefix,
        http2: false,
      })
      return {
        prefix: target.logPrefix,
        action: async (stdout, stderr, signal) => {
          target.action(stdout, stderr, signal, targetPort)
        },
      }
    }),
  )

  output.concurrent(processes)

  const availablePort = portNumber ?? (await port.getRandomPort())
  server.listen(availablePort)
  return {
    port: availablePort,
    close: server.close,
  }
}
