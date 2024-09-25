import {parseCookies, serializeCookies} from './cookies.js'
import {defaultHeaders, storefrontReplaceTemplatesParams} from './storefront-utils.js'
import {DevServerSession, DevServerRenderContext} from './types.js'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {fetch, type Response} from '@shopify/cli-kit/node/http'
import {createError} from 'h3'

export async function render(session: DevServerSession, context: DevServerRenderContext): Promise<Response> {
  const url = buildStorefrontUrl(session, context)
  const replaceTemplates = Object.keys({...context.replaceTemplates, ...context.replaceExtensionTemplates})

  outputDebug(`→ Rendering ${url} (with ${replaceTemplates})...`)

  const bodyParams = storefrontReplaceTemplatesParams(context)
  const headers = await buildHeaders(session, context)

  const response = await fetch(url, {
    method: 'POST',
    body: bodyParams,
    headers: {
      ...headers,
      ...defaultHeaders(),
    },
  }).catch((error: Error) => {
    throw createError({
      status: 502,
      statusText: 'Bad Gateway',
      data: {url},
      cause: error,
    })
  })

  const requestId = response.headers.get('x-request-id')
  outputDebug(`← ${response.status} (request_id: ${requestId})`)

  /**
   * Theme Access app requests return the 'application/json' content type.
   * However, patched renderings will never patch JSON requests; so we're
   * consistently discarding the content type.
   */
  response.headers.delete('Content-Type')

  return response
}

async function buildHeaders(session: DevServerSession, context: DevServerRenderContext) {
  if (isThemeAccessSession(session)) {
    return buildThemeAccessHeaders(session, context)
  } else {
    return buildStandardHeaders(session, context)
  }
}

async function buildStandardHeaders(session: DevServerSession, context: DevServerRenderContext) {
  const cookies = await buildCookies(session, context)
  const storefrontToken = session.storefrontToken

  return cleanHeader({
    ...context.headers,
    Authorization: `Bearer ${storefrontToken}`,
    Cookie: cookies,
  })
}

async function buildThemeAccessHeaders(session: DevServerSession, context: DevServerRenderContext) {
  const cookies = await buildCookies(session, context)
  const storefrontToken = session.storefrontToken
  const filteredHeaders: {[key: string]: string} = {}
  const filterKeys = ['ACCEPT', 'CONTENT-TYPE', 'CONTENT-LENGTH']

  for (const [key, value] of Object.entries(context.headers)) {
    if (filterKeys.includes(key.toUpperCase())) {
      filteredHeaders[key] = value
    }
  }

  return cleanHeader({
    ...filteredHeaders,
    ...themeAccessHeaders(session),
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
  const params = new URLSearchParams({
    _fd: '0',
    pb: '0',
  })

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
    return 'https://theme-kit-access.shopifyapps.com/cli/sfr'
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

function cleanHeader(headers: {[key: string]: string}): {[key: string]: string} {
  // Force the use of the 'Cookie' key if consumers also provide the 'cookie' key
  delete headers.cookie
  delete headers.authorization
  return headers
}
