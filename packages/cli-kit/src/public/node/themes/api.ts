import {storeAdminUrl} from './urls.js'
import * as throttler from '../api/rest-api-throttler.js'
import {restRequest, RestResponse} from '@shopify/cli-kit/node/api/admin'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {
  buildBulkUploadResults,
  buildChecksum,
  buildTheme,
  buildThemeAsset,
} from '@shopify/cli-kit/node/themes/factories'
import {Result, Checksum, Key, Theme, ThemeAsset} from '@shopify/cli-kit/node/themes/types'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {sleep} from '@shopify/cli-kit/node/system'

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
  // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
  return buildThemeAsset(response.json.asset)
}

export async function deleteThemeAsset(id: number, key: Key, session: AdminSession): Promise<boolean> {
  const response = await request('DELETE', `/themes/${id}/assets`, session, undefined, {
    'asset[key]': key,
  })
  return response.status === 200
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

interface UpgradeThemeOptions {
  fromTheme: number
  toTheme: number
  script?: string
  session: AdminSession
}

export async function upgradeTheme(upgradeOptions: UpgradeThemeOptions): Promise<Theme | undefined> {
  const {fromTheme, toTheme, session, script} = upgradeOptions
  const params = {from_theme: fromTheme, to_theme: toTheme, ...(script && {script})}
  const response = await request('POST', `/themes`, session, params)
  return buildTheme(response.json.theme)
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
  retries = 1,
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
      // Retry 401 errors to be resilient to authentication errors.
      return handleRetriableError({
        path,
        retries,
        retry: () => {
          return request(method, path, session, params, searchParams, retries + 1)
        },
        fail: () => {
          throw new AbortError(`[${status}] API request unauthorized error`)
        },
      })
    case status === 422:
      throw new AbortError(`[${status}] API request unprocessable content: ${errors(response)}`)
    case status >= 400 && status <= 499:
      throw new AbortError(`[${status}] API request client error`)
    case status >= 500 && status <= 599:
      // Retry 500-family of errors as that may solve the issue (especially in 503 errors)
      return handleRetriableError({
        path,
        retries,
        retry: () => {
          return request(method, path, session, params, searchParams, retries + 1)
        },
        fail: () => {
          throw new AbortError(`[${status}] API request server error`)
        },
      })
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

interface RetriableErrorOptions {
  path: string
  retries: number
  retry: () => Promise<RestResponse>
  fail: () => never
}

async function handleRetriableError({path, retries, retry, fail}: RetriableErrorOptions): Promise<RestResponse> {
  if (retries >= 3) {
    fail()
  }

  outputDebug(`[${retries}] Retrying '${path}' request...`)

  await sleep(0.2)
  return retry()
}
