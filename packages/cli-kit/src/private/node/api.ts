import {sanitizedHeadersOutput} from './api/headers.js'
import {sanitizeURL} from './api/urls.js'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {Headers} from 'form-data'
import {ClientError} from 'graphql-request'
import {performance} from 'perf_hooks'

export type API = 'admin' | 'storefront-renderer' | 'partners' | 'business-platform'

export const allAPIs: API[] = ['admin', 'storefront-renderer', 'partners', 'business-platform']

interface RequestOptions<T> {
  request: Promise<T>
  url: string
}

const interestingResponseHeaders = new Set(['cache-control', 'content-type', 'etag', 'x-request-id'])

export async function debugLogResponseInfo<T extends {headers: Headers; status: number}>(
  {request, url}: RequestOptions<T>,
  errorHandler?: (error: unknown, requestId: string | undefined) => Error | unknown,
): Promise<T> {
  const t0 = performance.now()
  const responseHeaders: {[key: string]: string} = {}
  let response: T = {} as T
  try {
    response = await request
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    response.headers.forEach((value: any, key: any) => {
      if (interestingResponseHeaders.has(key)) responseHeaders[key] = value
    })
  } catch (err) {
    if (err instanceof ClientError) {
      if (err.response?.headers) {
        for (const [key, value] of err.response?.headers as Iterable<[string, string]>) {
          if (interestingResponseHeaders.has(key)) responseHeaders[key] = value
        }
      }
    }
    if (errorHandler) {
      throw errorHandler(err, responseHeaders['x-request-id'])
    } else {
      throw err
    }
  } finally {
    const t1 = performance.now()
    outputDebug(`Request to ${sanitizeURL(url)} completed in ${Math.round(t1 - t0)} ms
With response headers:
${sanitizedHeadersOutput(responseHeaders)}
    `)
  }
  return response
}
