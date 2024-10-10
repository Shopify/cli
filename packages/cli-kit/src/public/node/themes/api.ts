import {storeAdminUrl} from './urls.js'
import * as throttler from '../api/rest-api-throttler.js'
import {ThemeUpdate} from '../../../cli/api/graphql/admin/generated/theme_update.js'
import {ThemeDelete} from '../../../cli/api/graphql/admin/generated/theme_delete.js'
import {ThemePublish} from '../../../cli/api/graphql/admin/generated/theme_publish.js'
import {restRequest, RestResponse, adminRequestDoc} from '@shopify/cli-kit/node/api/admin'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {
  buildBulkUploadResults,
  buildChecksum,
  buildTheme,
  buildThemeAsset,
} from '@shopify/cli-kit/node/themes/factories'
import {Result, Checksum, Key, Theme, ThemeAsset} from '@shopify/cli-kit/node/themes/types'

export type ThemeParams = Partial<Pick<Theme, 'name' | 'role' | 'processing' | 'src'>>
export type AssetParams = Pick<ThemeAsset, 'key'> & Partial<Pick<ThemeAsset, 'value' | 'attachment'>>

export async function fetchTheme(id: number, session: AdminSession): Promise<Theme | undefined> {
  const response = await request('GET', `/themes/${id}`, session, undefined, {fields: 'id,name,role,processing'})
  return buildTheme(response.json.theme)
}

export async function fetchThemes(session: AdminSession): Promise<Theme[]> {
  const response = await request('GET', '/themes', session, undefined, {fields: 'id,name,role,processing'})
  const themes = response.json?.themes
  if (themes?.length > 0) return themes.map(buildTheme)
  return []
}

export async function createTheme(params: ThemeParams, session: AdminSession): Promise<Theme | undefined> {
  const response = await request('POST', '/themes', session, {theme: {...params}})
  const minimumThemeAssets = [
    {key: 'config/settings_schema.json', value: '[]'},
    {key: 'layout/password.liquid', value: '{{ content_for_header }}{{ content_for_layout }}'},
    {key: 'layout/theme.liquid', value: '{{ content_for_header }}{{ content_for_layout }}'},
  ]

  await bulkUploadThemeAssets(response.json.theme.id, minimumThemeAssets, session)

  return buildTheme({...response.json.theme, createdAtRuntime: true})
}

export async function fetchThemeAsset(id: number, key: Key, session: AdminSession): Promise<ThemeAsset | undefined> {
  const response = await request('GET', `/themes/${id}/assets`, session, undefined, {
    'asset[key]': key,
  })
  return buildThemeAsset(response.json.asset)
}

export async function deleteThemeAsset(id: number, key: Key, session: AdminSession): Promise<boolean> {
  const response = await request('DELETE', `/themes/${id}/assets`, session, undefined, {
    'asset[key]': key,
  })
  return Boolean(response.json.message)
}

export async function bulkUploadThemeAssets(
  id: number,
  assets: AssetParams[],
  session: AdminSession,
): Promise<Result[]> {
  const response = await request('PUT', `/themes/${id}/assets/bulk`, session, {assets})
  if (response.status !== 207) {
    throw new AbortError('Upload failed, could not reach the server')
  }
  return buildBulkUploadResults(response.json.results, assets)
}

export async function fetchChecksums(id: number, session: AdminSession): Promise<Checksum[]> {
  const response = await request('GET', `/themes/${id}/assets`, session, undefined, {fields: 'key,checksum'})
  const assets = response.json.assets

  if (assets?.length > 0) return assets.map(buildChecksum)

  return []
}

export async function themeUpdate(id: number, params: ThemeParams, session: AdminSession): Promise<Theme | undefined> {
  const name = params.name
  if (name === undefined) {
    throw new Error('Theme name is required')
  }
  const response = await adminRequestDoc(
    ThemeUpdate,
    session,
    {
      id: themeGid(id),
      input: {name},
    },
    'unstable',
  )
  const theme = response.themeUpdate?.theme
  if (!theme) {
    const userErrors = response.themeUpdate?.userErrors.map((error) => error.message).join(', ')
    throw new Error(userErrors)
  }

  return buildTheme({
    id: parseInt((theme.id as unknown as string).split('/').pop() as string, 10),
    name: theme.name,
    role: theme.role.toLowerCase(),
  })
}

export async function themePublish(id: number, session: AdminSession): Promise<Theme | undefined> {
  const response = await adminRequestDoc(ThemePublish, session, {id: themeGid(id)}, 'unstable')

  const theme = response.themePublish?.theme
  if (!theme) {
    const userErrors = response.themePublish?.userErrors.map((error) => error.message).join(', ')
    throw new Error(userErrors)
  }

  return buildTheme({
    id: parseInt((theme.id as unknown as string).split('/').pop() as string, 10),
    name: theme.name,
    role: theme.role.toLowerCase(),
  })
}

export async function themeDelete(id: number, session: AdminSession): Promise<boolean | undefined> {
  const response = await adminRequestDoc(ThemeDelete, session, {id: themeGid(id)}, 'unstable')

  const themeId = response.themeDelete?.deletedThemeId

  if (!themeId) {
    const userErrors = response.themeDelete?.userErrors.map((error) => error.message).join(', ')
    throw new Error(userErrors)
  }
  return true
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

  throttler.updateApiCallLimitFromResponse(response)

  switch (true) {
    case status >= 200 && status <= 399:
      // Returns the successful reponse
      return response
    case status === 404:
      // Defer the decision when a resource is not found
      return response
    case status === 429:
      // Retry following the "retry-after" header
      return throttler.delayAwareRetry(response, () => request(method, path, session, params, searchParams))
    case status === 403:
      return handleForbiddenError(response, session)
    case status === 401:
      throw new AbortError(`[${status}] API request unauthorized error`)
    case status === 422:
      throw new AbortError(`[${status}] API request unprocessable content: ${errors(response)}`)
    case status >= 400 && status <= 499:
      throw new AbortError(`[${status}] API request client error`)
    case status >= 500 && status <= 599:
      throw new AbortError(`[${status}] API request server error`)
    default:
      throw new AbortError(`[${status}] API request unexpected error`)
  }
}

function handleForbiddenError(response: RestResponse, session: AdminSession): never {
  const store = session.storeFqdn
  const adminUrl = storeAdminUrl(session)
  const error = errorMessage(response)

  if (error.match(/Cannot delete generated asset/) !== null) {
    throw new AbortError(error)
  }

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

function errors(response: RestResponse) {
  return JSON.stringify(response.json?.errors)
}

function errorMessage(response: RestResponse): string {
  const message = response.json?.message

  if (typeof message === 'string') {
    return message
  }

  return ''
}

function themeGid(id: number): string {
  return `gid://shopify/OnlineStoreTheme/${id}`
}
