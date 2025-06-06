import {buildHeaders} from './headers.js'
import {themeKitAccessDomain} from '../constants.js'
import {AdminSession} from '../../../public/node/session.js'

export function restRequestBody<T>(requestBody?: T) {
  if (!requestBody) {
    return
  }
  return JSON.stringify(requestBody)
}

export function restRequestUrl(
  session: AdminSession,
  apiVersion: string,
  path: string,
  searchParams: {[name: string]: string} = {},
) {
  const url = new URL(
    isThemeAccessSession(session)
      ? `https://${themeKitAccessDomain}/cli/admin/api/${apiVersion}${path}.json`
      : `https://${session.storeFqdn}/admin/api/${apiVersion}${path}.json`,
  )
  Object.entries(searchParams).forEach(([name, value]) => {
    url.searchParams.set(name, value)
  })

  return url.toString()
}

export function restRequestHeaders(session: AdminSession) {
  const store = session.storeFqdn
  const token = session.token
  const headers = buildHeaders(session.token)

  if (isThemeAccessSession(session)) {
    headers['X-Shopify-Shop'] = store
    headers['X-Shopify-Access-Token'] = token
  }

  return headers
}

export function isThemeAccessSession(session: AdminSession) {
  return session.token.startsWith('shptka_')
}
