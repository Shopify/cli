import {renderWarning} from '@shopify/cli-kit/node/ui'
import {
  defineEventHandler,
  clearResponseHeaders,
  sendProxy,
  getProxyRequestHeaders,
  getRequestWebStream,
  type H3Event,
} from 'h3'
import type {Theme} from '@shopify/cli-kit/node/themes/types'
import type {DevServerContext} from './types.js'

const IGNORED_ENDPOINTS = [
  '/.well-known',
  '/shopify/monorail',
  '/mini-profiler-resources',
  '/web-pixels-manager',
  '/wpm',
]

export function getProxyHandler(_theme: Theme, ctx: DevServerContext) {
  return defineEventHandler(async (event) => {
    if (IGNORED_ENDPOINTS.some((endpoint) => event.path.startsWith(endpoint))) {
      // Mock successful status 204 response
      return null
    }

    if (!event.headers.get('accept')?.includes('text/html')) {
      return proxyStorefrontRequest(event, ctx)
    }
  })
}

export function injectCdnProxy(content: string, ctx: DevServerContext) {
  const cdnPath = '/cdn/'
  const cdnRE = new RegExp(`(https?:)?//${ctx.session.storeFqdn.replace('.', '\\.')}${cdnPath}`, 'g')
  return content.replaceAll(cdnRE, cdnPath)
}

// These headers are meaningful only for a single transport-level connection,
// and must not be retransmitted by proxies or cached.
// https://tools.ietf.org/html/draft-ietf-httpbis-p1-messaging-14#section-7.1.3.1Acc
const HOP_BY_HOP_HEADERS = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-security-policy',
  'content-length',
]

function proxyStorefrontRequest(event: H3Event, ctx: DevServerContext) {
  const target = `https://${ctx.session.storeFqdn}${event.path}`
  const pathname = event.path.split('?')[0]!
  const body = getRequestWebStream(event)

  const proxyRequestHeaders = getProxyRequestHeaders(event) as {[key: string]: string | undefined}
  // Required header for CDN requests
  proxyRequestHeaders.referer = target
  // H3 already removes most hop-by-hop request headers, but not these:
  // https://github.com/unjs/h3/blob/ac6d83de2abe5411d4eaea8ecf2165ace16a65f3/src/utils/proxy.ts#L25
  for (const headerKey of HOP_BY_HOP_HEADERS) {
    delete proxyRequestHeaders[headerKey]
  }

  return sendProxy(event, target, {
    headers: proxyRequestHeaders,
    fetchOptions: {method: event.method, body, duplex: body ? 'half' : undefined},
    cookieDomainRewrite: `http://${ctx.options.host}:${ctx.options.port}`,
    async onResponse(event, response) {
      clearResponseHeaders(event, HOP_BY_HOP_HEADERS)

      if (!response.ok && response.status >= 500) {
        renderWarning({
          headline: `Failed to proxy request to ${pathname}`,
          body: `${response.status} - ${response.statusText}`,
        })
      }
    },
  }).catch((error) => {
    renderWarning({
      headline: `Failed to proxy request to ${pathname}`,
      body: error.stack ?? error.message,
    })
  })
}
