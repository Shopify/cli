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
  setResponseStatus,
} from 'h3'
import {lookupMimeType} from '@shopify/cli-kit/node/mimes'
import {extname} from '@shopify/cli-kit/node/path'
import type {Theme} from '@shopify/cli-kit/node/themes/types'
import type {Response as NodeResponse} from '@shopify/cli-kit/node/http'
import type {DevServerContext} from './types.js'

const VANITY_CDN_PREFIX = '/cdn/'
const IGNORED_ENDPOINTS = [
  '/.well-known',
  '/shopify/monorail',
  '/mini-profiler-resources',
  '/web-pixels-manager',
  '/wpm',
]

/**
 * Forwards non-HTML requests to the remote SFR instance,
 * or mocks the result for certain endpoints.
 */
export function getProxyHandler(_theme: Theme, ctx: DevServerContext) {
  return defineEventHandler(async (event) => {
    if (IGNORED_ENDPOINTS.some((endpoint) => event.path.startsWith(endpoint))) {
      // Mock successful status 204 response
      return null
    }

    if (canProxyRequest(event)) {
      return proxyStorefrontRequest(event, ctx)
    }
  })
}

/**
 * Check if a request should be proxied to the remote SFR instance.
 * Cases:
 * - /cdn/... -- Proxy
 * - /.../file.js -- Proxy
 * - /.../index.html -- No Proxy
 * - /payments/config | accepts: application/json -- Proxy
 * - /search/suggest | accepts: * / * -- No proxy
 */
function canProxyRequest(event: H3Event) {
  if (event.path.startsWith(VANITY_CDN_PREFIX)) return true

  const [pathname] = event.path.split('?') as [string]
  const extension = extname(pathname)
  const acceptsType = event.headers.get('accept') ?? '*/*'

  if (extension === '.html' || acceptsType.includes('text/html')) return false

  return Boolean(extension) || acceptsType !== '*/*'
}

function getStoreFqdnForRegEx(ctx: DevServerContext) {
  return ctx.session.storeFqdn.replaceAll('.', '\\.')
}

/**
 * Replaces every VanityCDN-like (...myshopify.com/cdn/...) URL to pass through the local server.
 * It also replaces MainCDN-like (cdn.shopify.com/...) URLs to files that are known local assets.
 * Other MainCDN matches are left unmodified.
 */
export function injectCdnProxy(originalContent: string, ctx: DevServerContext) {
  let content = originalContent

  // -- Redirect all usages to the vanity CDN to the local server:
  const vanityCdnRE = new RegExp(`(https?:)?//${getStoreFqdnForRegEx(ctx)}${VANITY_CDN_PREFIX}`, 'g')
  content = content.replace(vanityCdnRE, VANITY_CDN_PREFIX)

  // -- Only redirect usages of the main CDN for known local assets to the local server:
  const mainCdnRE = /(?:https?:)?\/\/cdn\.shopify\.com\/(.*?\/(assets\/[^?">]+)(?:\?|"|>|$))/g
  const existingAssets = new Set([...ctx.localThemeFileSystem.files.keys()].filter((key) => key.startsWith('assets')))
  content = content.replace(mainCdnRE, (matchedUrl, pathname, matchedAsset) => {
    const isLocalAsset = matchedAsset && existingAssets.has(matchedAsset as string)
    if (!isLocalAsset) return matchedUrl
    // Do not proxy images, they may require filters or other CDN features
    if (lookupMimeType(matchedAsset).startsWith('image/')) return matchedUrl
    // Prefix with vanityCdnPath to later read local assets
    return `${VANITY_CDN_PREFIX}${pathname}`
  })

  return content
}

function patchBaseUrlAttributes(html: string, ctx: DevServerContext) {
  const newBaseUrl = `http://${ctx.options.host}:${ctx.options.port}`
  const dataBaseUrlRE = new RegExp(`data-base-url=["']((?:https?:)?//${getStoreFqdnForRegEx(ctx)})[^"']*?["']`, 'g')

  return html.replace(dataBaseUrlRE, (match, m1) => match.replace(m1, newBaseUrl))
}

function patchCookieDomains(cookieHeader: string[], ctx: DevServerContext) {
  // Domains are invalid for localhost:
  const domainRE = new RegExp(`Domain=${getStoreFqdnForRegEx(ctx)};\\s*`, 'gi')
  return cookieHeader.map((value) => value.replace(domainRE, '')).join(', ')
}

/**
 * Patches the result of an SFR HTML response to include the local proxies
 * and fix domain inconsistencies between remote instance and local dev.
 */
export async function patchRenderingResponse(ctx: DevServerContext, event: H3Event, response: NodeResponse) {
  setResponseStatus(event, response.status, response.statusText)
  setResponseHeaders(event, Object.fromEntries(response.headers.entries()))
  patchProxiedResponseHeaders(ctx, event, response)

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

function patchProxiedResponseHeaders(ctx: DevServerContext, event: H3Event, response: Response | NodeResponse) {
  // Safari adds upgrade-insecure-requests to CSP and it needs to be removed:
  clearResponseHeaders(event, HOP_BY_HOP_HEADERS)

  // Link header preloads resources from global CDN, proxy it:
  const linkHeader = response.headers.get('Link')
  if (linkHeader) setResponseHeader(event, 'Link', injectCdnProxy(linkHeader, ctx))

  // Cookies are set for the vanity domain, fix it for localhost:
  const setCookieHeader =
    'raw' in response.headers ? response.headers.raw()['set-cookie'] : response.headers.getSetCookie()
  if (setCookieHeader?.length) setResponseHeader(event, 'Set-Cookie', patchCookieDomains(setCookieHeader, ctx))
}

/**
 * Filters headers to forward to SFR.
 */
export function getProxyStorefrontHeaders(event: H3Event) {
  const proxyRequestHeaders = getProxyRequestHeaders(event) as {[key: string]: string}

  // H3 already removes most hop-by-hop request headers:
  // https://github.com/unjs/h3/blob/ac6d83de2abe5411d4eaea8ecf2165ace16a65f3/src/utils/proxy.ts#L25
  for (const headerKey of HOP_BY_HOP_HEADERS) {
    delete proxyRequestHeaders[headerKey]
  }

  // Safari adds this by default. Remove it to prevent upgrading to HTTPS in localhost.
  // This header is however ignored by SFR and it always returns a CSP including it,
  // so we must also remove it from the response CSP.
  delete proxyRequestHeaders['upgrade-insecure-requests']

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
    onResponse: patchProxiedResponseHeaders.bind(null, ctx),
  }).catch(async (error: H3Error) => {
    if (error.statusCode >= 500 && !pathname.endsWith('.js.map')) {
      const cause = error.cause as undefined | Error
      renderWarning({
        headline: `Failed to proxy request to ${pathname} - ${error.statusCode} - ${error.statusMessage}`,
        body: cause?.stack ?? error.stack ?? error.message,
      })
    }

    await sendError(event, error)

    // Ensure other middlewares are not called:
    return null
  })
}
