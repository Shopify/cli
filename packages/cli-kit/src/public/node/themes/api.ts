import {storeAdminUrl} from './urls.js'
import {composeThemeGid, parseGid} from './utils.js'
import * as throttler from '../api/rest-api-throttler.js'
import {ThemeUpdate} from '../../../cli/api/graphql/admin/generated/theme_update.js'
import {ThemeDelete} from '../../../cli/api/graphql/admin/generated/theme_delete.js'
import {ThemePublish} from '../../../cli/api/graphql/admin/generated/theme_publish.js'
import {GetThemeFileBodies} from '../../../cli/api/graphql/admin/generated/get_theme_file_bodies.js'
import {GetThemeFileChecksums} from '../../../cli/api/graphql/admin/generated/get_theme_file_checksums.js'
import {restRequest, RestResponse, adminRequestDoc} from '@shopify/cli-kit/node/api/admin'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {buildBulkUploadResults, buildTheme} from '@shopify/cli-kit/node/themes/factories'
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

export async function createTheme(params: ThemeParams, session: AdminSession): Promise<Theme | undefined> {
  const response = await request('POST', '/themes', session, {theme: {...params}})

  if (!params.src) {
    const minimumThemeAssets = [
      {key: 'config/settings_schema.json', value: '[]'},
      {key: 'layout/password.liquid', value: '{{ content_for_header }}{{ content_for_layout }}'},
      {key: 'layout/theme.liquid', value: '{{ content_for_header }}{{ content_for_layout }}'},
    ]

    await bulkUploadThemeAssets(response.json.theme.id, minimumThemeAssets, session)
  }

  return buildTheme({...response.json.theme, createdAtRuntime: true})
}

export async function fetchThemeAssets(id: number, filenames: Key[], session: AdminSession): Promise<ThemeAsset[]> {
  const assets: ThemeAsset[] = []
  let after: string | null = null

  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const response = await adminRequestDoc(GetThemeFileBodies, session, {
      id: themeGid(id),
      filenames,
      after,
    })

    if (!response.theme?.files?.nodes || !response.theme?.files?.pageInfo) {
      const userErrors = response.theme?.files?.userErrors.map((error) => error.filename).join(', ')
      throw new AbortError(`Error fetching assets: ${userErrors}`)
    }

    const {nodes, pageInfo} = response.theme.files

    assets.push(
      // eslint-disable-next-line no-await-in-loop
      ...(await Promise.all(
        nodes.map(async (file) => {
          const content = await parseThemeFileContent(file.body)
          return {
            key: file.filename,
            checksum: file.checksumMd5 as string,
            value: content,
          }
        }),
      )),
    )

    if (!pageInfo.hasNextPage) {
      return assets
    }

    after = pageInfo.endCursor as string
  }
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
  const checksums: Checksum[] = []
  let after: string | null = null

  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const response = await adminRequestDoc(GetThemeFileChecksums, session, {id: themeGid(id), after})

    if (!response?.theme?.files?.nodes || !response?.theme?.files?.pageInfo) {
      const userErrors = response.theme?.files?.userErrors.map((error) => error.filename).join(', ')
      throw new AbortError(`Failed to fetch checksums for: ${userErrors}`)
    }

    const {nodes, pageInfo} = response.theme.files

    checksums.push(
      ...nodes.map((file) => ({
        key: file.filename,
        checksum: file.checksumMd5 as string,
      })),
    )

    if (!pageInfo.hasNextPage) {
      return checksums
    }

    after = pageInfo.endCursor as string
  }
}

export async function themeUpdate(id: number, params: ThemeParams, session: AdminSession): Promise<Theme | undefined> {
  const name = params.name
  const input: {[key: string]: string} = {}
  if (name) {
    input.name = name
  }

  const {themeUpdate} = await adminRequestDoc(ThemeUpdate, session, {id: composeThemeGid(id), input})
  if (!themeUpdate) {
    // An unexpected error occurred during the GraphQL request execution
    unexpectedGraphQLError('Failed to update theme')
  }

  const {theme, userErrors} = themeUpdate
  if (userErrors.length) {
    const userErrors = themeUpdate.userErrors.map((error) => error.message).join(', ')
    throw new AbortError(userErrors)
  }

  if (!theme) {
    // An unexpected error if neither theme nor userErrors are returned
    unexpectedGraphQLError('Failed to update theme')
  }

  return buildTheme({
    id: parseGid(theme.id),
    name: theme.name,
    role: theme.role.toLowerCase(),
  })
}

export async function themePublish(id: number, session: AdminSession): Promise<Theme | undefined> {
  const {themePublish} = await adminRequestDoc(ThemePublish, session, {id: composeThemeGid(id)})
  if (!themePublish) {
    // An unexpected error occurred during the GraphQL request execution
    unexpectedGraphQLError('Failed to update theme')
  }

  const {theme, userErrors} = themePublish
  if (userErrors.length) {
    const userErrors = themePublish.userErrors.map((error) => error.message).join(', ')
    throw new AbortError(userErrors)
  }

  if (!theme) {
    // An unexpected error if neither theme nor userErrors are returned
    unexpectedGraphQLError('Failed to update theme')
  }

  return buildTheme({
    id: parseGid(theme.id),
    name: theme.name,
    role: theme.role.toLowerCase(),
  })
}

export async function themeDelete(id: number, session: AdminSession): Promise<boolean | undefined> {
  const {themeDelete} = await adminRequestDoc(ThemeDelete, session, {id: composeThemeGid(id)})
  if (!themeDelete) {
    // An unexpected error occurred during the GraphQL request execution
    unexpectedGraphQLError('Failed to update theme')
  }

  const {deletedThemeId, userErrors} = themeDelete
  if (userErrors.length) {
    const userErrors = themeDelete.userErrors.map((error) => error.message).join(', ')
    throw new AbortError(userErrors)
  }

  if (!deletedThemeId) {
    // An unexpected error if neither theme nor userErrors are returned
    unexpectedGraphQLError('Failed to update theme')
  }

  return true
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
      /**
       * We need to resolve the call to the refresh function at runtime to
       * avoid a circular reference.
       *
       * This won't be necessary when https://github.com/Shopify/cli/issues/4769
       * gets resolved, and this condition must be removed then.
       */
      if ('refresh' in session) {
        const refresh = session.refresh as () => Promise<void>
        await refresh()
      }

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

function unexpectedGraphQLError(message: string): never {
  throw new AbortError(message)
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

function themeGid(id: number): string {
  return `gid://shopify/OnlineStoreTheme/${id}`
}

type OnlineStoreThemeFileBody =
  | {__typename: 'OnlineStoreThemeFileBodyBase64'; contentBase64: string}
  | {__typename: 'OnlineStoreThemeFileBodyText'; content: string}
  | {__typename: 'OnlineStoreThemeFileBodyUrl'; url: string}

async function parseThemeFileContent(body: OnlineStoreThemeFileBody): Promise<string> {
  switch (body.__typename) {
    case 'OnlineStoreThemeFileBodyText':
      return body.content
      break
    case 'OnlineStoreThemeFileBodyBase64':
      return Buffer.from(body.contentBase64, 'base64').toString()
      break
    case 'OnlineStoreThemeFileBodyUrl':
      try {
        const response = await fetch(body.url)
        return await response.text()
      } catch (error) {
        // Raise error if we can't download the file
        throw new AbortError(`Error downloading content from URL: ${body.url}`)
      }
  }
}
