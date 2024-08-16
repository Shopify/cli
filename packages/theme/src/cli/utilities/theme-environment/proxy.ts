import {renderWarning} from '@shopify/cli-kit/node/ui'
import {
  defineEventHandler,
  clearResponseHeaders,
  sendProxy,
  getProxyRequestHeaders,
  getRequestWebStream,
  getRequestIP,
  type H3Event,
  type H3Error,
  sendError,
  setResponseHeaders,
  setResponseHeader,
  removeResponseHeader,
} from 'h3'
import type {Theme} from '@shopify/cli-kit/node/themes/types'
import type {Response as NodeResponse} from '@shopify/cli-kit/node/http'
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

    if (event.path.startsWith('/cdn/') || !event.headers.get('accept')?.includes('text/html')) {
      return proxyStorefrontRequest(event, ctx)
    }
  })
}

/**
 * Replaces every VanityCDN-like (...myshopify.com/cdn/...) URL to pass through the local server.
 * It also replaces MainCDN-like (cdn.shopify.com/...) URLs to files that are known local assets.
 * Other MainCDN matches are left unmodified.
 */
export function injectCdnProxy(originalContent: string, ctx: DevServerContext) {
  let content = originalContent

  // -- Redirect all usages to the vanity CDN to the local server:
  const vanityCdnPath = '/cdn/'
  const vanityCdnRE = new RegExp(`(https?:)?//${ctx.session.storeFqdn.replace('.', '\\.')}${vanityCdnPath}`, 'g')
  content = content.replace(vanityCdnRE, vanityCdnPath)

  // -- Only redirect usages of the main CDN for known local assets to the local server:
  const mainCdnRE = /(?:https?:)?\/\/cdn\.shopify\.com\/(.*?\/(assets\/[^?]+)(?:\?|$))/g
  const existingAssets = new Set([...ctx.localThemeFileSystem.files.keys()].filter((key) => key.startsWith('assets')))
  content = content.replace(mainCdnRE, (matchedUrl, pathname, matchedAsset) => {
    const isLocalAsset = matchedAsset && existingAssets.has(matchedAsset as string)
    // Prefix with vanityCdnPath to later read local assets
    return isLocalAsset ? `${vanityCdnPath}${pathname}` : matchedUrl
  })

  return content
}

function patchBaseUrlAttributes(html: string, ctx: DevServerContext) {
  const newBaseUrl = `http://${ctx.options.host}:${ctx.options.port}`
  const dataBaseUrlRE = new RegExp(
    `data-base-url=["']((?:https?:)?//${ctx.session.storeFqdn.replace('.', '\\.')})[^"']*?["']`,
    'g',
  )

  return html.replaceAll(dataBaseUrlRE, (match, m1) => match.replace(m1, newBaseUrl))
}

function patchCookieWithProxy(cookieHeader: string[], ctx: DevServerContext) {
  // Domains are invalid for localhost:
  const domainRE = new RegExp(`Domain=${ctx.session.storeFqdn.replaceAll('.', '\\.')};\\s*`, 'gi')
  return cookieHeader.map((value) => value.replace(domainRE, '')).join(', ')
}

export async function patchRenderingResponse(event: H3Event, response: NodeResponse, ctx: DevServerContext) {
  setResponseHeaders(event, Object.fromEntries(response.headers.entries()))

  const linkHeader = response.headers.get('Link')
  if (linkHeader) setResponseHeader(event, 'Link', injectCdnProxy(linkHeader, ctx))

  const setCookieHeader = response.headers.raw()['set-cookie']
  if (setCookieHeader) setResponseHeader(event, 'Set-Cookie', patchCookieWithProxy(setCookieHeader, ctx))

  // We are decoding the payload here, remove the header:
  let html = await response.text()
  removeResponseHeader(event, 'content-encoding')

  html = injectCdnProxy(html, ctx)
  html = patchBaseUrlAttributes(html, ctx)

  return html
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

export function getProxyStorefrontHeaders(event: H3Event) {
  const proxyRequestHeaders = getProxyRequestHeaders(event) as {[key: string]: string}

  // H3 already removes most hop-by-hop request headers, but not these:
  // https://github.com/unjs/h3/blob/ac6d83de2abe5411d4eaea8ecf2165ace16a65f3/src/utils/proxy.ts#L25
  for (const headerKey of HOP_BY_HOP_HEADERS) {
    delete proxyRequestHeaders[headerKey]
  }

  const ipAddress = getRequestIP(event)
  if (ipAddress) proxyRequestHeaders['X-Forwarded-For'] = ipAddress

  return proxyRequestHeaders
}

function proxyStorefrontRequest(event: H3Event, ctx: DevServerContext) {
  const target = `https://${ctx.session.storeFqdn}${event.path}`
  const pathname = event.path.split('?')[0]!
  const body = getRequestWebStream(event)

  const proxyHeaders = getProxyStorefrontHeaders(event)
  // Required header for CDN requests
  proxyHeaders.referer = target

  return sendProxy(event, target, {
    headers: proxyHeaders,
    fetchOptions: {ignoreResponseError: false, method: event.method, body, duplex: body ? 'half' : undefined},
    cookieDomainRewrite: `http://${ctx.options.host}:${ctx.options.port}`,
    async onResponse(event) {
      clearResponseHeaders(event, HOP_BY_HOP_HEADERS)
    },
  }).catch(async (error: H3Error) => {
    if (error.statusCode >= 500) {
      const cause = error.cause as undefined | Error
      renderWarning({
        headline: `Failed to proxy request to ${pathname} - ${error.statusCode} - ${error.statusMessage}`,
        body: cause?.stack ?? error.stack ?? error.message,
      })
    }

    await sendError(event, error)
    return null
  })
}
