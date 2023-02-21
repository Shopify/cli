import {sanitizedHeadersOutput} from './api/headers.js'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {performance} from 'perf_hooks'

export type API = 'admin' | 'storefront-renderer' | 'partners'

export const allAPIs: API[] = ['admin', 'storefront-renderer', 'partners']

interface RequestOptions<T> {
  request: Promise<T>
  url: string
}

const interestingResponseHeaders = new Set(['cache-control', 'content-type', 'etag', 'x-request-id'])

export async function debugLogResponseInfo<T extends {headers: Headers; status: number}>({
  request,
  url,
}: RequestOptions<T>): Promise<T> {
  const t0 = performance.now()
  const response = await request
  const t1 = performance.now()

  const responseHeaders: {[key: string]: string} = {}
  response.headers.forEach((value, key) => {
    if (interestingResponseHeaders.has(key)) responseHeaders[key] = value
  })
  outputDebug(`Request to ${url} completed in ${Math.round(t1 - t0)} ms
With response headers:
${sanitizedHeadersOutput(responseHeaders)}
    `)

  return response
}
