import {storeAdminUrl} from './theme-urls.js'
import {Theme} from './models/theme.js'
import * as throttler from '../../../private/node/themes/themes-api/throttler.js'
import {apiCallLimit, retryAfter} from '../../../private/node/themes/themes-api/headers.js'
import {retry} from '../../../private/node/themes/themes-api/retry.js'
import {restRequest, RestResponse} from '@shopify/cli-kit/node/api/admin'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'

export type ThemeParams = Partial<Pick<Theme, 'name' | 'role'>>

export async function fetchTheme(id: number, session: AdminSession): Promise<Theme | undefined> {
  const response = await request('GET', `/themes/${id}`, session, undefined, {fields: 'id'})
  return buildTheme(response.json.theme)
}

export async function fetchThemes(session: AdminSession): Promise<Theme[]> {
  const response = await request('GET', '/themes', session, undefined, {fields: 'id,name,role'})
  return buildThemes(response)
}

export async function createTheme(params: ThemeParams, session: AdminSession): Promise<Theme | undefined> {
  const response = await request('POST', '/themes', session, {theme: {...params}})
  return buildTheme({...response.json.theme, createdAtRuntime: true})
}

export async function updateTheme(id: number, params: ThemeParams, session: AdminSession): Promise<Theme | undefined> {
  const response = await request('PUT', `/themes/${id}`, session, {theme: {id, ...params}})
  return buildTheme(response.json.theme)
}

export async function publishTheme(id: number, session: AdminSession): Promise<Theme | undefined> {
  return updateTheme(id, {role: 'main'}, session)
}

export async function deleteTheme(id: number, session: AdminSession): Promise<Theme | undefined> {
  const response = await request('DELETE', `/themes/${id}`, session)
  return buildTheme(response.json.theme)
}

async function request<T>(
  method: string,
  path: string,
  session: AdminSession,
  params?: T,
  searchParams: {[name: string]: string} = {},
): Promise<RestResponse> {
  const response = await throttler.throttle(() => restRequest(method, path, session, params, searchParams))

  const status = response.status
  const callLimit = apiCallLimit(response)

  throttler.updateApiCallLimit(callLimit)

  switch (true) {
    case status >= 200 && status <= 399:
      // Returns the successful reponse
      return response
    case status === 404:
      // Defer the decision when a resource is not found
      return response
    case status === 429:
      // Retry following the "retry-after" header
      return retry(() => request(method, path, session, params, searchParams), retryAfter(response))
    case status === 403:
      return handleForbiddenError(session)
    case status === 401:
      throw new AbortError(`[${status}] API request unauthorized error`)
    case status >= 400 && status <= 499:
      throw new AbortError(`[${status}] API request client error`)
    case status >= 500 && status <= 599:
      throw new AbortError(`[${status}] API request server error`)
    default:
      throw new AbortError(`[${status}] API request unexpected error`)
  }
}

function buildThemes(response: RestResponse): Theme[] {
  const themes = response.json?.themes

  if (themes?.length > 0) {
    return themes.map(buildTheme)
  }

  return []
}

// Using `any` to avoid introducing extra DTO layers.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildTheme(themeJson: any): Theme | undefined {
  if (!themeJson?.id) {
    return undefined
  }

  return new Theme(themeJson.id, themeJson.name, themeJson.role, themeJson.createdAtRuntime)
}

function handleForbiddenError(session: AdminSession): never {
  const store = session.storeFqdn
  const adminUrl = storeAdminUrl(session)

  throw new AbortError(
    `You are not authorized to edit themes on "${store}".`,
    "You can't use Shopify CLI with development stores if you only have Partner staff " +
      'member access. If you want to use Shopify CLI to work on a development store, then ' +
      'you should be the store owner or create a staff account on the store.' +
      '\n\n' +
      "If you're the store owner, then you need to log in to the store directly using the " +
      `store URL at least once (for example, using "${adminUrl}") before you log in using ` +
      'Shopify CLI. Logging in to the Shopify admin directly connects the development ' +
      'store with your Shopify login.',
  )
}
