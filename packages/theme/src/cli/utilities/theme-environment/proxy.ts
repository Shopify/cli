/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-dynamic-delete */
import {buildCookies} from './storefront-renderer.js'
import {logRequestLine} from '../log-request-line.js'
import {renderWarning} from '@shopify/cli-kit/node/ui'
import {
  defineEventHandler,
  clearResponseHeaders,
  sendProxy,
  getRequestHeaders,
  getRequestWebStream,
  getRequestIP,
  type H3Event,
  type H3Error,
  sendError,
  setResponseHeaders,
  setResponseHeader,
  removeResponseHeader,
  setResponseStatus,
  send,
} from 'h3'
import {extname} from '@shopify/cli-kit/node/path'
import {lookupMimeType} from '@shopify/cli-kit/node/mimes'
import type {Theme} from '@shopify/cli-kit/node/themes/types'
import type {Response as NodeResponse} from '@shopify/cli-kit/node/http'
import type {DevServerContext} from './types.js'

export const VANITY_CDN_PREFIX = '/cdn/'
export const EXTENSION_CDN_PREFIX = '/ext/cdn/'

const CART_PATTERN = /^\/cart\//
const CHECKOUT_PATTERN = /^\/checkouts\//
const ACCOUNT_PATTERN = /^\/account(\/login\/multipass(\/[^/]+)?)?\/?$/
const VANITY_CDN_PATTERN = new RegExp(`^${VANITY_CDN_PREFIX}`)
const EXTENSION_CDN_PATTERN = new RegExp(`^${EXTENSION_CDN_PREFIX}`)

const IGNORED_ENDPOINTS = [
  '/.well-known',
  '/shopify/monorail',
  '/mini-profiler-resources',
  '/web-pixels-manager',
  '/wpm',
  '/services/',
]

const SESSION_COOKIE_NAME = '_shopify_essential'
const SESSION_COOKIE_REGEXP = new RegExp(`${SESSION_COOKIE_NAME}=([^;]*)(;|$)`)

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
 *
 * Cases:
 *
 * | Path              | Accept header      | Action   |
 * |-------------------|--------------------|----------|
 * | /cdn/...          |                    | Proxy    |
 * | /ext/cdn/...      |                    | Proxy    |
 * | /.../file.js      |                    | Proxy    |
 * | /cart/...         |                    | Proxy    |
 * | /payments/config  | application/json   | Proxy    |
 * | /search/suggest   | * / *              | No proxy |
 * | /.../index.html   |                    | No Proxy |
 *
 */
export function canProxyRequest(event: H3Event) {
  // console.log('checkout: ', event.path.match(CHECKOUT_PATTERN))
  if (event.method !== 'GET') return true
  if (event.path.match(CART_PATTERN)) return true
  if (event.path.match(CHECKOUT_PATTERN)) return true
  if (event.path.match(ACCOUNT_PATTERN)) return true
  if (event.path.match(VANITY_CDN_PATTERN)) return true
  if (event.path.match(EXTENSION_CDN_PATTERN)) return true

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

  // -- Only redirect usages of the main CDN for known local theme and theme extension assets to the local server:
  const mainCdnRE = /(?:https?:)?\/\/cdn\.shopify\.com\/(.*?\/(assets\/[^?#"'`>\s]+))/g
  const filterAssets = (key: string) => key.startsWith('assets/')
  const existingAssets = new Set([...ctx.localThemeFileSystem.files.keys()].filter(filterAssets))
  const existingExtAssets = new Set([...ctx.localThemeExtensionFileSystem.files.keys()].filter(filterAssets))

  content = content.replace(mainCdnRE, (matchedUrl, pathname, matchedAsset) => {
    const isLocalAsset = matchedAsset && existingAssets.has(matchedAsset)
    const isLocalExtAsset = matchedAsset && existingExtAssets.has(matchedAsset) && pathname.startsWith('extensions/')
    const isImage = lookupMimeType(matchedAsset).startsWith('image/')

    // Do not proxy images, they may require filters or other CDN features
    if (isImage) return matchedUrl

    // Proxy theme extension assets
    if (isLocalExtAsset) return `${EXTENSION_CDN_PREFIX}${pathname}`

    // Proxy theme assets
    if (isLocalAsset) return `${VANITY_CDN_PREFIX}${pathname}`

    return matchedUrl
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
  return cookieHeader.map((value) => value.replace(domainRE, ''))
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
  // Ensure the content type indicates UTF-8 charset:
  setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')

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
  'expect',
  'content-security-policy',
  'host',
]

function patchProxiedResponseHeaders(ctx: DevServerContext, event: H3Event, response: Response | NodeResponse) {
  // Safari adds upgrade-insecure-requests to CSP and it needs to be removed:
  clearResponseHeaders(event, HOP_BY_HOP_HEADERS)

  // Link header preloads resources from global CDN, proxy it:
  const linkHeader = response.headers.get('Link')
  if (linkHeader) setResponseHeader(event, 'Link', injectCdnProxy(linkHeader, ctx))

  // Location header might contain the store domain, proxy it:
  const locationHeader = response.headers.get('Location')
  if (locationHeader) {
    const url = new URL(locationHeader, 'https://shopify.dev')
    url.searchParams.delete('_fd')
    url.searchParams.delete('pb')
    setResponseHeader(event, 'Location', url.href.replace(url.origin, ''))
  }

  // Cookies are set for the vanity domain, fix it for localhost:
  const setCookieHeader =
    'raw' in response.headers ? response.headers.raw()['set-cookie'] : response.headers.getSetCookie()
  if (setCookieHeader?.length) {
    setResponseHeader(event, 'Set-Cookie', patchCookieDomains(setCookieHeader, ctx))
    const latestShopifyEssential = setCookieHeader.join(',').match(SESSION_COOKIE_REGEXP)?.[1]
    if (latestShopifyEssential) {
      console.log(
        `!! setting the new shopify essential cookie: ${latestShopifyEssential}, it was ${ctx.session.sessionCookies[SESSION_COOKIE_NAME]}`,
      )
      ctx.session.sessionCookies[SESSION_COOKIE_NAME] = latestShopifyEssential
    }
  }
}

/**
 * Filters headers to forward to SFR.
 */
export function getProxyStorefrontHeaders(event: H3Event) {
  const proxyRequestHeaders = getRequestHeaders(event) as {[key: string]: string}

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
  const path = event.path.replaceAll(EXTENSION_CDN_PREFIX, '/')
  const host = event.path.startsWith(EXTENSION_CDN_PREFIX) ? 'cdn.shopify.com' : ctx.session.storeFqdn
  const url = new URL(path, `https://${host}`)

  // When a .css.liquid or .js.liquid file is requested but it doesn't exist in SFR,
  // it will be rendered with a query string like `assets/file.css?1234`.
  // For some reason, after refreshing, this rendered URL keeps the wrong `?1234`
  // query string for a while. We replace it with a proper timestamp here to fix it.
  if (/\/assets\/[^/]+\.(css|js)$/.test(url.pathname) && /\?\d+$/.test(url.search)) {
    url.search = `?v=${Date.now()}`
  }

  url.searchParams.set('_fd', '0')
  url.searchParams.set('pb', '0')
  const headers = getProxyStorefrontHeaders(event)
  const body = getRequestWebStream(event)

  const fetchOpts = event.path.match(CHECKOUT_PATTERN)
    ? {
        redirect: 'manual',
      }
    : {
        redirect: 'manual',
      }

  console.log('sending the proxy................ ', event.method, url.toString())
  const headers3 = {
    'Accept-Encoding': 'none',
    'ACCEPT-LANGUAGE': headers['accept-language'] || headers['ACCEPT-LANGUAGE'],
    ACCEPT: headers.accept || headers.ACCEPT,
    'CACHE-CONTROL': 'max-age=0',
    CONNECTION: 'keep-alive',
    Cookie: buildCookies(ctx.session, {headers}),
    DNT: '1',
    Host: 'se-gopro-en-c7m9.myshopify.com',
    REFERER: 'http://127.0.0.1:9292/',
    'SEC-CH-UA-MOBILE': '?0',
    'SEC-CH-UA-PLATFORM': '"macOS"',
    'SEC-CH-UA': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'SEC-FETCH-DEST': 'document',
    'SEC-FETCH-MODE': 'navigate',
    'SEC-FETCH-SITE': 'same-origin',
    'SEC-FETCH-USER': '?1',
    'UPGRADE-INSECURE-REQUESTS': '1',
    'User-Agent': 'Shopify CLI',
    VERSION: 'HTTP/1.1',
    'X-Forwarded-For': '127.0.0.1',
  }
  console.log('---------------------------------')
  console.log('Request Headers:')
  Object.entries(headers3).forEach(([name, value]) => {
    console.log(`${name}: ${value}`)
  })
  console.log('---------------------------------')

  // For cart URLs, ensure we pass the shopify_essential cookie
  if (url.hostname === 'se-gopro-en-c7m9.myshopify.com' && url.pathname === '/cart') {
    const shopifyEssential = ctx.session.sessionCookies[SESSION_COOKIE_NAME]
    if (shopifyEssential) {
      console.log(`Adding shopify_essential cookie for cart: ${shopifyEssential}`)
      headers3.Cookie = headers3.Cookie
        ? `${headers3.Cookie}; ${SESSION_COOKIE_NAME}=${shopifyEssential}`
        : `${SESSION_COOKIE_NAME}=${shopifyEssential}`
    }
  }

  return sendProxy(event, url.toString(), {
    headers: headers3,
    fetchOptions: {
      ignoreResponseError: false,
      method: event.method,
      body,
      duplex: body ? 'half' : undefined,
      // Important to return 3xx responses to the client
      ...fetchOpts,
    } as any,
    async onResponse(event, response) {
      console.log('we got a response!')

      console.log('---------------------------------')
      console.log('Response Headers:')
      response.headers.forEach((value, name) => {
        console.log(`${name}: ${value}`)
      })
      console.log('---------------------------------')

      logRequestLine(event, response)

      patchProxiedResponseHeaders(ctx, event, response)

      const fileName = url.pathname.split('/').at(-1)
      if (ctx.localThemeFileSystem.files.has(`assets/${fileName}.liquid`)) {
        // Patch Liquid assets like .css.liquid
        const body = await response.text()
        await send(event, injectCdnProxy(body, ctx))
      }
    },
  }).catch(async (error: H3Error) => {
    console.log('we got an error!')

    const pathname = event.path.split('?')[0]!
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
