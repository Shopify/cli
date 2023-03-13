import {sanitizedHeadersOutput} from './api/headers.js'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {ClientError} from 'graphql-request'
import {performance} from 'perf_hooks'

export type API = 'admin' | 'storefront-renderer' | 'partners'

export const allAPIs: API[] = ['admin', 'storefront-renderer', 'partners']

interface RequestOptions<T> {
  request: Promise<T>
  url: string
}

const interestingResponseHeaders = new Set(['cache-control', 'content-type', 'etag', 'x-request-id'])

export async function debugLogResponseInfo<T extends {headers: Headers; status: number}>(
  {request, url}: RequestOptions<T>,
  errorHandler?: (error: unknown) => Error | unknown,
): Promise<T> {
  const t0 = performance.now()
  const responseHeaders: {[key: string]: string} = {}
  let response: T = {} as T
  try {
    response = await request
    response.headers.forEach((value, key) => {
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
      throw errorHandler(err)
    } else {
      throw err
    }
  } finally {
    const t1 = performance.now()
    outputDebug(`Request to ${url} completed in ${Math.round(t1 - t0)} ms
With response headers:
${sanitizedHeadersOutput(responseHeaders)}
    `)
  }
  return response
}
