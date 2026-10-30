import {DevServerSession, DevServerRenderContext} from './types.js'
import {cleanHeader, defaultHeaders, storefrontReplaceTemplatesParams} from './storefront-utils.js'
import {parseCookies, serializeCookies} from './cookies.js'
import {createFetchError} from '../errors.js'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {getThemeKitAccessDomain} from '@shopify/cli-kit/node/context/local'
import {recordError} from '@shopify/cli-kit/node/analytics'
import {fetch as nodeFetch} from '@shopify/cli-kit/node/http'

/** Query params that the renderer sets on every storefront request. */
export const STOREFRONT_RENDERER_QUERY_PARAMS = {_fd: '0', pb: '0'}

/**
 * The storefront page that confirms a shopper wants to leave the store
 * (`/url` or `/:locale/url`). Storefront links to other sites go through it.
 */
const EXIT_PAGE_PATH_REGEX = /^(?:\/[a-z]{2,3}(?:-[a-zA-Z0-9]{2,})?)?\/url\/?$/

export async function render(session: DevServerSession, context: DevServerRenderContext): Promise<Response> {
  const url = buildStorefrontUrl(session, context)
  const headers = await buildHeaders(session, context)
  const requestHeaders = {
    ...headers,
    ...defaultHeaders(),
  }
  let response: Response

  const replaceTemplates = Object.keys({...context.replaceTemplates, ...context.replaceExtensionTemplates})

  if (isExitPageRequest(context)) {
    outputDebug(`→ Rendering ${url} (exit page)...`)

    response = await fetchExitPage(url, requestHeaders).catch((error) => {
      throw createFetchError(recordError(error), url)
    })
  } else if (replaceTemplates.length > 0) {
    outputDebug(`→ Rendering ${url} (with ${replaceTemplates})...`)

    const bodyParams = storefrontReplaceTemplatesParams(context)

    // eslint-disable-next-line no-restricted-globals
    response = await fetch(url, {
      method: 'POST',
      body: bodyParams,
      redirect: 'manual',
      headers: requestHeaders,
    }).catch((error) => {
      throw createFetchError(recordError(error), url)
    })
  } else {
    outputDebug(`→ Rendering ${url}...`)

    // eslint-disable-next-line no-restricted-globals
    response = await fetch(url, {
      method: context.method,
      redirect: 'manual',
      headers: requestHeaders,
    }).catch((error) => {
      throw createFetchError(recordError(error), url)
    })
  }

  const requestId = response.headers.get('x-request-id')
  outputDebug(`← ${response.status} (request_id: ${requestId})`)

  /**
   * Theme Access app requests return the 'application/json' content type.
   * However, patched renderings will never patch JSON requests; so we're
   * only discarding the content type for non-JSON responses that will be patched.
   */
  const contentType = response.headers.get('Content-Type')
  const isJsonResponse = contentType?.includes('application/json')

  response = new Response(response.body, response)

  if (!isJsonResponse) {
    response.headers.delete('Content-Type')
  }

  return response
}

function isExitPageRequest({method, path}: Pick<DevServerRenderContext, 'method' | 'path'>) {
  return method.toUpperCase() === 'GET' && EXIT_PAGE_PATH_REGEX.test(path)
}

/**
 * The exit page only redirects to another site when the request is a real
 * navigation (`Sec-Fetch-Mode: navigate`), as it is for the browser's request
 * to the local server. Node's global `fetch` always replaces the
 * `Sec-Fetch-Mode` header with its own request mode (`cors`), so the page would
 * always show the confirmation instead. The CLI's `fetch` sends the header as
 * is. The exit page doesn't render theme templates, so it's always a GET.
 */
async function fetchExitPage(url: string, headers: Record<string, string>): Promise<Response> {
  const response = await nodeFetch(url, {method: 'GET', redirect: 'manual', headers}, 'slow-request')

  const responseHeaders = new Headers()
  for (const [key, values] of Object.entries(response.headers.raw())) {
    for (const value of values) responseHeaders.append(key, value)
  }

  const hasNullBody = [101, 103, 204, 205, 304].includes(response.status)

  return new Response(hasNullBody ? null : await response.arrayBuffer(), {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}

export async function buildHeaders(session: DevServerSession, context: Pick<DevServerRenderContext, 'headers'>) {
  if (isThemeAccessSession(session)) {
    return buildThemeAccessHeaders(session, context)
  } else {
    return buildStandardHeaders(session, context)
  }
}

async function buildStandardHeaders(session: DevServerSession, context: Pick<DevServerRenderContext, 'headers'>) {
  const cookies = await buildCookies(session, context)
  const storefrontToken = session.storefrontToken

  return cleanHeader({
    ...context.headers,
    ...session.crawlerSignatureHeaders,
    Authorization: `Bearer ${storefrontToken}`,
    Cookie: cookies,
  })
}

async function buildThemeAccessHeaders(session: DevServerSession, context: Pick<DevServerRenderContext, 'headers'>) {
  const cookies = await buildCookies(session, context)
  const storefrontToken = session.storefrontToken
  const filteredHeaders: Record<string, string> = {}
  const filterKeys = ['ACCEPT', 'CONTENT-TYPE', 'CONTENT-LENGTH']

  for (const [key, value] of Object.entries(context.headers)) {
    if (filterKeys.includes(key.toUpperCase())) {
      filteredHeaders[key] = value
    }
  }

  return cleanHeader({
    ...filteredHeaders,
    ...themeAccessHeaders(session),
    ...session.crawlerSignatureHeaders,
    Authorization: `Bearer ${storefrontToken}`,
    Cookie: cookies,
  })
}

export function buildCookies(session: DevServerSession, ctx: Pick<DevServerRenderContext, 'headers'>) {
  const cookies = parseCookies(ctx.headers.cookie ?? ctx.headers.Cookie ?? '')
  const sessionCookies = session.sessionCookies ?? {}

  return serializeCookies({
    ...cookies,
    ...sessionCookies,
  })
}

function buildStorefrontUrl(session: DevServerSession, {path, sectionId, appBlockId, query}: DevServerRenderContext) {
  const baseUrl = buildBaseStorefrontUrl(session)
  const url = `${baseUrl}${path}`
  const params = new URLSearchParams(STOREFRONT_RENDERER_QUERY_PARAMS)

  for (const [key, value] of query) {
    params.append(key, value)
  }

  // The Section Rendering API takes precendence over the Block Rendering API.
  if (sectionId) {
    params.append('section_id', sectionId)
  } else if (appBlockId) {
    params.append('app_block_id', appBlockId)
  }

  return `${url}?${params}`
}

export function buildBaseStorefrontUrl(session: AdminSession) {
  if (isThemeAccessSession(session)) {
    return `https://${getThemeKitAccessDomain()}/cli/sfr`
  } else {
    return `https://${session.storeFqdn}`
  }
}

function isThemeAccessSession(session: AdminSession) {
  return session.token.startsWith('shptka_')
}

function themeAccessHeaders(session: DevServerSession) {
  return {
    'X-Shopify-Shop': session.storeFqdn,
    'X-Shopify-Access-Token': session.token,
  }
}
