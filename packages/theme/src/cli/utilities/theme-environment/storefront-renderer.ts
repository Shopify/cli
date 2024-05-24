import {getStorefrontSessionCookies} from './storefront-session.js'
import {parseCookies, serializeCookies} from './cookies.js'
import {defaultHeaders, storefrontReplaceTemplatesParams} from './storefront-utils.js'
import {DevServerSession, DevServerRenderContext} from './types.js'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {ensureAuthenticatedStorefront} from '@shopify/cli-kit/node/session'
import {fetch, Response} from '@shopify/cli-kit/node/http'

export async function render(session: DevServerSession, context: DevServerRenderContext): Promise<Response> {
  const url = buildStorefrontUrl(session, context)

  outputDebug(`→ Rendering ${url} (with ${Object.keys(context.replaceTemplates)})...`)

  const bodyParams = storefrontReplaceTemplatesParams(context.replaceTemplates)
  const headers = await buildHeaders(session, context)

  const response = await fetch(url, {
    method: 'POST',
    body: bodyParams,
    headers: {
      ...headers,
      ...defaultHeaders(),
    },
  })

  outputDebug(`← ${response.status} (request_id: ${response.headers.get('x-request-id')})`)

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
  const storefrontToken = await ensureAuthenticatedStorefront([])

  return {
    Authorization: `Bearer ${storefrontToken}`,
    Cookie: cookies,
    ...context.headers,
  }
}

async function buildThemeAccessHeaders(session: DevServerSession, context: DevServerRenderContext) {
  const cookies = await buildCookies(session, context)
  const storefrontToken = await ensureAuthenticatedStorefront([])
  const filteredHeaders: {[key: string]: string} = {}
  const filterKeys = ['ACCEPT', 'CONTENT-TYPE', 'CONTENT-LENGTH']

  for (const [key, value] of Object.entries(context.headers)) {
    if (filterKeys.includes(key.toUpperCase())) {
      filteredHeaders[key] = value
    }
  }

  return {
    ...filteredHeaders,
    ...themeAccessHeaders(session),
    Authorization: `Bearer ${storefrontToken}`,
    Cookie: cookies,
  }
}

async function buildCookies(session: DevServerSession, {themeId, cookies: cookieString}: DevServerRenderContext) {
  const cookies = parseCookies(cookieString)
  const baseUrl = buildBaseStorefrontUrl(session)
  const headers = isThemeAccessSession(session) ? themeAccessHeaders(session) : {}
  const storefrontPassword = session.storefrontPassword

  const sessionCookies = await getStorefrontSessionCookies(baseUrl, themeId, storefrontPassword, headers)

  return serializeCookies({
    ...cookies,
    ...sessionCookies,
  })
}

function buildStorefrontUrl(session: DevServerSession, {path, sectionId, query}: DevServerRenderContext) {
  const baseUrl = buildBaseStorefrontUrl(session)
  const url = `${baseUrl}${path}`
  const params = new URLSearchParams({
    _fd: '0',
    pb: '0',
  })

  for (const [key, value] of query) {
    params.append(key, value)
  }

  if (sectionId) {
    params.append('section_id', sectionId)
  }

  return `${url}?${params}`
}

function buildBaseStorefrontUrl(session: DevServerSession) {
  if (isThemeAccessSession(session)) {
    return 'https://theme-kit-access.shopifyapps.com/cli/sfr'
  } else {
    return `https://${session.storeFqdn}`
  }
}

function isThemeAccessSession(session: DevServerSession) {
  return session.token.startsWith('shptka_')
}

function themeAccessHeaders(session: DevServerSession) {
  return {
    'X-Shopify-Shop': session.storeFqdn,
    'X-Shopify-Access-Token': session.token,
  }
}
