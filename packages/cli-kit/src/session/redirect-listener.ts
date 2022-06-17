import {
  getFavicon,
  getStylesheet,
  getEmptyUrlHTML,
  getAuthErrorHTML,
  getMissingCodeHTML,
  getMissingStateHTML,
  getSuccessHTML,
  EmptyUrlString,
  MissingCodeString,
  MissingStateString,
} from './post-auth'
import {Abort, Bug} from '../error'
import * as output from '../output'
import Fastify from 'fastify'
import url from 'url'

const ResponseTimeoutSeconds = 10
const ServerStopDelaySeconds = 0.5

/**
 * It represents the result of a redirect.
 */
type RedirectCallback = (error: Error | undefined, state: string | undefined, code: string | undefined) => void

/**
 * Defines the interface of the options that
 * are used to instantiate a redirect listener.
 */
interface RedirectListenerOptions {
  host: string
  port: number
  callback: RedirectCallback
}
/**
 * When the authentication completes, Identity redirects
 * the user to a URL. In the case of the CLI, the redirect
 * is to localhost passing some parameters that are necessary
 * to continue the authentication. Because of that, we need
 * an HTTP server that runs and listens to the request.
 */
export class RedirectListener {
  private static createServer(callback: RedirectCallback) {
    const server = Fastify().get('*', async (request, reply) => {
      const requestUrl = request.url
      if (requestUrl === '/favicon.svg') {
        const faviconFile = await getFavicon()
        reply.header('Content-Type', 'image/svg+xml').send(faviconFile)
        return {}
      } else if (requestUrl === '/style.css') {
        const stylesheetFile = await getStylesheet()
        reply.header('Content-Type', 'text/css').send(stylesheetFile)
        return {}
      }

      const respond = (contents: string, error?: Error, state?: string, code?: string) => {
        reply.header('Content-Type', 'text/html').send(contents)
        callback(error, state, code)
        return {}
      }

      // If there was an empty/malformed URL sent back.
      if (!requestUrl) {
        const file = await getEmptyUrlHTML()
        const err = new Bug(EmptyUrlString)
        return respond(file, err, undefined, undefined)
      }

      // If an error was returned by the Identity server.
      const queryObject = url.parse(requestUrl, true).query
      if (queryObject.error && queryObject.error_description) {
        const file = await getAuthErrorHTML()
        const err = new Abort(`${queryObject.error_description}`)
        return respond(file, err, undefined, undefined)
      }

      // If the code isn't present in the URL.
      if (!queryObject.code) {
        const file = await getMissingCodeHTML()
        const err = new Bug(MissingCodeString)
        return respond(file, err, undefined, undefined)
      }

      // If the state isn't present in the URL.
      if (!queryObject.state) {
        const file = await getMissingStateHTML()
        const err = new Bug(MissingStateString)
        return respond(file, err, undefined, undefined)
      }

      const file = await getSuccessHTML()
      return respond(file, undefined, `${queryObject.code}`, `${queryObject.state}`)
    })
    return server
  }

  port: number
  host: string
  server: ReturnType<typeof RedirectListener.createServer>

  constructor(options: RedirectListenerOptions) {
    this.port = options.port
    this.host = options.host
    this.server = RedirectListener.createServer(options.callback)
  }

  start(): void {
    this.server.listen({port: this.port, host: this.host}, () => {})
  }

  stop(): void {
    this.server.close()
  }
}

export async function listenRedirect(host: string, port: number, url: string): Promise<{code: string; state: string}> {
  const result = await new Promise<{code: string; state: string}>((resolve, reject) => {
    const timeout = setTimeout(() => {
      const message = '\nAuto-open timed out. Open the login page: '
      output.info(output.content`${message}${output.token.link('Log in to Shopify Partners', url)}\n`)
    }, ResponseTimeoutSeconds * 1000)

    const callback: RedirectCallback = async (error, code, state) => {
      clearTimeout(timeout)
      setTimeout(() => {
        redirectListener.stop()
        if (error) reject(error)
        else resolve({code: code as string, state: state as string})
      }, ServerStopDelaySeconds * 1000)
    }

    const redirectListener = new RedirectListener({host, port, callback})
    redirectListener.start()
  })
  return result
}
