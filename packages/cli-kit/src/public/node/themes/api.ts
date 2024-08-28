import {storeAdminUrl} from './urls.js'
import * as throttler from '../api/rest-api-throttler.js'
import {GetThemes} from '../../../cli/api/graphql/admin/generated/get_themes.js'
import {GetTheme} from '../../../cli/api/graphql/admin/generated/get_theme.js'
import {GetThemeFileBodies} from '../../../cli/api/graphql/admin/generated/get_theme_file_bodies.js'
import {GetThemeFileChecksums} from '../../../cli/api/graphql/admin/generated/get_theme_file_checksums.js'
import {adminRequestDoc, restRequest, RestResponse} from '@shopify/cli-kit/node/api/admin'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {buildBulkUploadResults, buildTheme, buildThemeAsset} from '@shopify/cli-kit/node/themes/factories'

import {Result, Checksum, Key, Theme, ThemeAsset} from '@shopify/cli-kit/node/themes/types'

export type ThemeParams = Partial<Pick<Theme, 'name' | 'role' | 'processing' | 'src'>>
export type AssetParams = Pick<ThemeAsset, 'key'> & Partial<Pick<ThemeAsset, 'value' | 'attachment'>>

export async function fetchTheme(id: number, session: AdminSession): Promise<Theme | undefined> {
  const vars = {id: `gid://shopify/Theme/${id}`}
  const response = await adminRequestDoc(GetTheme, session, vars)

  const theme = response.theme
  if (theme) {
    return buildTheme({
      id: parseInt((theme.id as unknown as string).split('/').pop() as string, 10),
      name: theme.name,
      role: theme.role.toLowerCase(),
    })
  }
}

export async function fetchThemes(session: AdminSession): Promise<Theme[]> {
  const themes: Theme[] = []

  while (true) {
    const vars: {after: string | null} = {after: null}
    // eslint-disable-next-line no-await-in-loop
    const response = await adminRequestDoc(GetThemes, session, vars)

    if (!response?.themes?.pageInfo || !response?.themes?.nodes) {
      // Raise error?
      return themes
    }

    const {nodes, pageInfo} = response.themes
    nodes.forEach((theme) => {
      // Strip off gid://shopify/Theme/ from the id
      // We should probably leave this as a gid for subsequent requests?
      const t = buildTheme({
        id: parseInt((theme.id as unknown as string).split('/').pop() as string, 10),
        name: theme.name,
        role: theme.role.toLowerCase(),
      })

      if (t !== undefined) {
        themes.push(t)
      }
    })
    if (pageInfo.hasNextPage) {
      vars.after = pageInfo.endCursor as string
    } else {
      break
    }
  }

  return themes
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

export async function fetchThemeAssets(
  id: number,
  filenames: Key[],
  session: AdminSession,
): Promise<ThemeAsset[] | undefined> {
  const assets: ThemeAsset[] = []
  const vars: {id: string; filenames: string[]; after: string | null} = {
    id: `gid://shopify/Theme/${id}`,
    filenames,
    after: null,
  }
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const response = await adminRequestDoc(GetThemeFileBodies, session, vars)
    if (!response.theme?.files?.nodes) {
      // Raise error?
      return assets
    }
    const {nodes, pageInfo} = response.theme.files
    nodes.forEach((file) => {
      if (file.file) {
        let content = ''
        switch (file.file.body.__typename) {
          case 'ThemeFileBodyUrl':
            throw new Error('URL content not supported yet')
          case 'ThemeFileBodyText':
            content = file.file.body.content
            break
          case 'ThemeFileBodyBase64':
            content = Buffer.from(file.file.body.contentBase64, 'base64').toString()
            break
        }
        assets.push({
          key: file.filename,
          checksum: file.file.checksumMd5 as string,
          value: content,
        })
      }
    })
    if (pageInfo.hasNextPage) {
      vars.after = pageInfo.endCursor as string
    } else {
      return assets
    }
  }
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
  const checksums: Checksum[] = []

  const vars: {id: string; after: string | null} = {id: `gid://shopify/Theme/${id}`, after: null}

  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const response = await adminRequestDoc(GetThemeFileChecksums, session, vars)

    if (!response.theme || !response.theme.files) {
      // Raise error?
      return checksums
    }

    const {nodes, pageInfo} = response.theme.files

    if (!nodes || !pageInfo) {
      // Raise error?
      return checksums
    }

    nodes.forEach((file) => {
      checksums.push({key: file.filename, checksum: file.file?.checksumMd5 as string})
    })
    if (pageInfo.hasNextPage) {
      vars.after = pageInfo.endCursor as string
    } else {
      return checksums
    }
  }
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
