import http from 'http'
import url from 'url'

import {Abort, Bug} from '../error'

export const EmptyUrlError = new Abort(
  'We received the authentication redirect but the URL is empty',
)
export const AuthenticationError = (message: string) => {
  return new Abort(message)
}
export const MissingCodeError = new Bug(
  `The authentication cannot contiue because the redirect doesn't include the code.`,
)

export const redirectResponseBody =
  'Continuing the authentication in your terminal...'

/**
 * It represents the result of a redirect.
 */
type RedirectCallback = (
  error: Error | undefined,
  code: string | undefined,
) => void

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
class RedirectListener {
  private static createServer(callback: RedirectCallback): http.Server {
    return http.createServer((request, response) => {
      const requestUrl = request.url

      const respond = () => {
        response.writeHead(200, {'Content-Type': 'text/html'})
        response.end(redirectResponseBody)
      }

      if (!requestUrl) {
        respond()
        return callback(EmptyUrlError, undefined)
      }
      const queryObject = url.parse(requestUrl, true).query

      if (queryObject.error && queryObject.error_description) {
        respond()
        return callback(
          AuthenticationError(`${queryObject.error_description}`),
          undefined,
        )
      }

      if (!queryObject.code) {
        respond()
        return callback(MissingCodeError, undefined)
      }

      respond()
      return callback(undefined, `${queryObject.code}`)
    })
  }

  port: number
  host: string
  server: http.Server

  constructor(options: RedirectListenerOptions) {
    this.port = options.port
    this.host = options.host
    this.server = RedirectListener.createServer(options.callback)
  }

  async start(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.server.listen(this.port, this.host, undefined, () => {
        resolve()
      })
    })
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.server.close((error) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }
}

export default RedirectListener
