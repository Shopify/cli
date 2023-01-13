import {buildHeaders} from './headers.js'
import {AdminSession} from '@shopify/cli-kit/node/session'

export function restRequestBody<T>(requestBody?: T) {
  if (!requestBody) {
    return
  }
  return JSON.stringify(requestBody)
}

export function restRequestUrl(session: AdminSession, apiVersion: string, path: string) {
  if (isThemeAccessSession(session)) {
    return `https://theme-kit-access.shopifyapps.com/cli/admin/api/${apiVersion}${path}.json`
  }

  return `https://${session.storeFqdn}/admin/api/${apiVersion}${path}.json`
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

function isThemeAccessSession(session: AdminSession) {
  return session.token.startsWith('shptka_')
}
