import {composeThemeGid, parseGid, DEVELOPMENT_THEME_ROLE} from './utils.js'
import {buildTheme} from './factories.js'
import {Result, Checksum, Key, Theme, ThemeAsset, Operation} from './types.js'
import {ThemeUpdate} from '../../../cli/api/graphql/admin/generated/theme_update.js'
import {ThemeDelete} from '../../../cli/api/graphql/admin/generated/theme_delete.js'
import {ThemeDuplicate} from '../../../cli/api/graphql/admin/generated/theme_duplicate.js'
import {ThemePublish} from '../../../cli/api/graphql/admin/generated/theme_publish.js'
import {ThemeCreate} from '../../../cli/api/graphql/admin/generated/theme_create.js'
import {GetThemeFileBodies} from '../../../cli/api/graphql/admin/generated/get_theme_file_bodies.js'
import {GetThemeFileChecksums} from '../../../cli/api/graphql/admin/generated/get_theme_file_checksums.js'
import {
  ThemeFilesUpsert,
  ThemeFilesUpsertMutation,
} from '../../../cli/api/graphql/admin/generated/theme_files_upsert.js'
import {ThemeFilesDelete} from '../../../cli/api/graphql/admin/generated/theme_files_delete.js'
import {
  OnlineStoreThemeFileBodyInputType,
  OnlineStoreThemeFilesUpsertFileInput,
  MetafieldOwnerType,
  ThemeRole,
} from '../../../cli/api/graphql/admin/generated/types.js'
import {MetafieldDefinitionsByOwnerType} from '../../../cli/api/graphql/admin/generated/metafield_definitions_by_owner_type.js'
import {GetThemes} from '../../../cli/api/graphql/admin/generated/get_themes.js'
import {GetTheme} from '../../../cli/api/graphql/admin/generated/get_theme.js'
import {OnlineStorePasswordProtection} from '../../../cli/api/graphql/admin/generated/online_store_password_protection.js'
import {RequestModeInput} from '../http.js'
import {adminRequestDoc} from '../api/admin.js'
import {AdminSession} from '../session.js'
import {AbortError} from '../error.js'
import {outputDebug} from '../output.js'
import {recordTiming, recordEvent, recordError} from '../analytics.js'

export type ThemeParams = Partial<Pick<Theme, 'name' | 'role' | 'processing' | 'src'>>
export type AssetParams = Pick<ThemeAsset, 'key'> & Partial<Pick<ThemeAsset, 'value' | 'attachment'>>
const SkeletonThemeCdn = 'https://cdn.shopify.com/static/online-store/theme-skeleton.zip'
const THEME_API_NETWORK_BEHAVIOUR: RequestModeInput = {
  useNetworkLevelRetry: true,
  useAbortSignal: false,
  maxRetryTimeMs: 90 * 1000,
}

export async function fetchTheme(id: number, session: AdminSession): Promise<Theme | undefined> {
  const gid = composeThemeGid(id)
  recordEvent('theme-api:fetch-theme')

  try {
    const {theme} = await adminRequestDoc({
      query: GetTheme,
      session,
      variables: {id: gid},
      responseOptions: {handleErrors: false},
      preferredBehaviour: THEME_API_NETWORK_BEHAVIOUR,
    })

    if (theme) {
      return buildTheme({
        id: parseGid(theme.id),
        processing: theme.processing,
        role: theme.role.toLowerCase(),
        name: theme.name,
      })
    }

    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    /**
     * Consumers of this and other theme APIs in this file expect either a theme
     * or `undefined`.
     *
     * Error handlers should not inspect GraphQL error messages directly, as
     * they are internationalized.
     */
    recordError(error)
    outputDebug(`Error fetching theme with ID: ${id}`)
  }
}

export async function fetchThemes(session: AdminSession): Promise<Theme[]> {
  const themes: Theme[] = []
  let after: string | null = null
  recordEvent('theme-api:fetch-themes')

  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const response = await adminRequestDoc({
      query: GetThemes,
      session,
      variables: {after},
      responseOptions: {handleErrors: false},
      preferredBehaviour: THEME_API_NETWORK_BEHAVIOUR,
    })
    if (!response.themes) {
      unexpectedGraphQLError('Failed to fetch themes')
    }
    const {nodes, pageInfo} = response.themes
    nodes.forEach((theme) => {
      const t = buildTheme({
        id: parseGid(theme.id),
        processing: theme.processing,
        role: theme.role.toLowerCase(),
        name: theme.name,
      })
      if (t) {
        themes.push(t)
      }
    })
    if (!pageInfo.hasNextPage) {
      return themes
    }

    after = pageInfo.endCursor as string
  }
}

export async function themeCreate(params: ThemeParams, session: AdminSession): Promise<Theme | undefined> {
  const themeSource = params.src ?? SkeletonThemeCdn
  recordEvent('theme-api:create-theme')
  const {themeCreate} = await adminRequestDoc({
    query: ThemeCreate,
    session,
    variables: {
      name: params.name ?? '',
      source: themeSource,
      role: (params.role ?? DEVELOPMENT_THEME_ROLE).toUpperCase() as ThemeRole,
    },
    responseOptions: {handleErrors: false},
    preferredBehaviour: THEME_API_NETWORK_BEHAVIOUR,
  })

  if (!themeCreate) {
    unexpectedGraphQLError('Failed to create theme')
  }

  const {theme, userErrors} = themeCreate
  if (userErrors.length) {
    const userErrors = themeCreate.userErrors.map((error) => error.message).join(', ')
    throw recordError(new AbortError(userErrors))
  }

  if (!theme) {
    unexpectedGraphQLError('Failed to create theme')
  }

  return buildTheme({
    id: parseGid(theme.id),
    name: theme.name,
    role: theme.role.toLowerCase(),
  })
}

export async function fetchThemeAssets(id: number, filenames: Key[], session: AdminSession): Promise<ThemeAsset[]> {
  const assets: ThemeAsset[] = []
  let after: string | null = null
  recordEvent('theme-api:fetch-assets')

  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const response = await adminRequestDoc({
      query: GetThemeFileBodies,
      session,
      variables: {id: themeGid(id), filenames, after},
      responseOptions: {handleErrors: false},
      preferredBehaviour: THEME_API_NETWORK_BEHAVIOUR,
    })

    if (!response.theme?.files?.nodes || !response.theme?.files?.pageInfo) {
      const userErrors = response.theme?.files?.userErrors.map((error) => error.filename).join(', ')
      unexpectedGraphQLError(`Error fetching assets: ${userErrors}`)
    }

    const {nodes, pageInfo} = response.theme.files

    assets.push(
      // eslint-disable-next-line no-await-in-loop
      ...(await Promise.all(
        nodes.map(async (file) => {
          const {attachment, value} = await parseThemeFileContent(file.body)
          return {
            attachment,
            key: file.filename,
            checksum: file.checksumMd5 as string,
            value,
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

export async function deleteThemeAssets(id: number, filenames: Key[], session: AdminSession): Promise<Result[]> {
  const batchSize = 50
  const results: Result[] = []
  recordEvent('theme-api:delete-assets')

  for (let i = 0; i < filenames.length; i += batchSize) {
    const batch = filenames.slice(i, i + batchSize)
    // eslint-disable-next-line no-await-in-loop
    const {themeFilesDelete} = await adminRequestDoc({
      query: ThemeFilesDelete,
      session,
      variables: {
        themeId: composeThemeGid(id),
        files: batch,
      },
      preferredBehaviour: THEME_API_NETWORK_BEHAVIOUR,
    })

    if (!themeFilesDelete) {
      unexpectedGraphQLError('Failed to delete theme assets')
    }

    const {deletedThemeFiles, userErrors} = themeFilesDelete

    if (deletedThemeFiles) {
      deletedThemeFiles.forEach((file) => {
        results.push({key: file.filename, success: true, operation: Operation.Delete})
      })
    }

    if (userErrors.length > 0) {
      userErrors.forEach((error) => {
        if (error.filename) {
          recordError(`Asset deletion failed for ${error.filename}: ${error.message}`)
          results.push({
            key: error.filename,
            success: false,
            operation: Operation.Delete,
            errors: {asset: [error.message]},
          })
        } else {
          unexpectedGraphQLError(`Failed to delete theme assets: ${error.message}`)
        }
      })
    }
  }

  return results
}

export async function bulkUploadThemeAssets(
  id: number,
  assets: AssetParams[],
  session: AdminSession,
): Promise<Result[]> {
  const results: Result[] = []
  recordEvent('theme-api:bulk-upload-assets')
  for (let i = 0; i < assets.length; i += 50) {
    const chunk = assets.slice(i, i + 50)
    const files = prepareFilesForUpload(chunk)

    recordTiming('theme-api:upload-files')
    // eslint-disable-next-line no-await-in-loop
    const uploadResults = await uploadFiles(id, files, session)
    recordTiming('theme-api:upload-files')

    results.push(...processUploadResults(uploadResults))
  }
  return results
}

function prepareFilesForUpload(assets: AssetParams[]): OnlineStoreThemeFilesUpsertFileInput[] {
  return assets.map((asset) => {
    if (asset.attachment) {
      return {
        filename: asset.key,
        body: {
          type: 'BASE64' as const,
          value: asset.attachment,
        },
      }
    } else {
      return {
        filename: asset.key,
        body: {
          type: 'TEXT' as const,
          value: asset.value ?? '',
        },
      }
    }
  })
}

async function uploadFiles(
  themeId: number,
  files: {filename: string; body: {type: OnlineStoreThemeFileBodyInputType; value: string}}[],
  session: AdminSession,
): Promise<ThemeFilesUpsertMutation> {
  return adminRequestDoc({
    query: ThemeFilesUpsert,
    session,
    variables: {themeId: themeGid(themeId), files},
    preferredBehaviour: THEME_API_NETWORK_BEHAVIOUR,
  })
}

function processUploadResults(uploadResults: ThemeFilesUpsertMutation): Result[] {
  const {themeFilesUpsert} = uploadResults

  if (!themeFilesUpsert) {
    unexpectedGraphQLError('Failed to upload theme files')
  }

  const {upsertedThemeFiles, userErrors} = themeFilesUpsert

  const results: Result[] = []

  upsertedThemeFiles?.forEach((file) => {
    results.push({
      key: file.filename,
      success: true,
      operation: Operation.Upload,
      asset: {
        key: file.filename,
        checksum: file.checksumMd5 ?? '',
      },
    })
  })

  userErrors.forEach((error) => {
    if (!error.filename) {
      unexpectedGraphQLError(`Error uploading theme files: ${error.message}`)
    }
    recordError(`Asset upload failed for ${error.filename}: ${error.message}`)
    results.push({
      key: error.filename,
      success: false,
      operation: Operation.Upload,
      errors: {asset: [error.message]},
    })
  })

  return results
}

export async function fetchChecksums(id: number, session: AdminSession): Promise<Checksum[]> {
  const checksums: Checksum[] = []
  let after: string | null = null
  recordEvent('theme-api:fetch-checksums')

  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const response = await adminRequestDoc({
      query: GetThemeFileChecksums,
      session,
      variables: {id: themeGid(id), after},
      responseOptions: {handleErrors: false},
      preferredBehaviour: THEME_API_NETWORK_BEHAVIOUR,
    })

    if (!response?.theme?.files?.nodes || !response?.theme?.files?.pageInfo) {
      const userErrors = response.theme?.files?.userErrors.map((error) => error.filename).join(', ')
      throw recordError(new AbortError(`Failed to fetch checksums for: ${userErrors}`))
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
  recordEvent('theme-api:update-theme')

  const {themeUpdate} = await adminRequestDoc({
    query: ThemeUpdate,
    session,
    variables: {id: composeThemeGid(id), input},
    preferredBehaviour: THEME_API_NETWORK_BEHAVIOUR,
  })
  if (!themeUpdate) {
    // An unexpected error occurred during the GraphQL request execution
    unexpectedGraphQLError('Failed to update theme')
  }

  const {theme, userErrors} = themeUpdate
  if (userErrors.length) {
    const userErrors = themeUpdate.userErrors.map((error) => error.message).join(', ')
    throw recordError(new AbortError(userErrors))
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
  recordEvent('theme-api:publish-theme')
  const {themePublish} = await adminRequestDoc({
    query: ThemePublish,
    session,
    variables: {id: composeThemeGid(id)},
    preferredBehaviour: THEME_API_NETWORK_BEHAVIOUR,
  })
  if (!themePublish) {
    // An unexpected error occurred during the GraphQL request execution
    unexpectedGraphQLError('Failed to update theme')
  }

  const {theme, userErrors} = themePublish
  if (userErrors.length) {
    const userErrors = themePublish.userErrors.map((error) => error.message).join(', ')
    throw recordError(new AbortError(userErrors))
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
  recordEvent('theme-api:delete-theme')
  const {themeDelete} = await adminRequestDoc({
    query: ThemeDelete,
    session,
    variables: {id: composeThemeGid(id)},
    preferredBehaviour: THEME_API_NETWORK_BEHAVIOUR,
  })
  if (!themeDelete) {
    // An unexpected error occurred during the GraphQL request execution
    unexpectedGraphQLError('Failed to update theme')
  }

  const {deletedThemeId, userErrors} = themeDelete
  if (userErrors.length) {
    const userErrors = themeDelete.userErrors.map((error) => error.message).join(', ')
    throw recordError(new AbortError(userErrors))
  }

  if (!deletedThemeId) {
    // An unexpected error if neither theme nor userErrors are returned
    unexpectedGraphQLError('Failed to update theme')
  }

  return true
}

export interface ThemeDuplicateResult {
  theme?: Theme
  userErrors: {field?: string[] | null; message: string}[]
  requestId?: string
}

export async function themeDuplicate(
  id: number,
  name: string | undefined,
  session: AdminSession,
): Promise<ThemeDuplicateResult> {
  let requestId: string | undefined
  recordEvent('theme-api:duplicate-theme')

  const {themeDuplicate} = await adminRequestDoc({
    query: ThemeDuplicate,
    session,
    variables: {id: composeThemeGid(id), name},
    preferredBehaviour: THEME_API_NETWORK_BEHAVIOUR,
    version: '2025-10',
    responseOptions: {
      onResponse: (response) => {
        requestId = response.headers.get('x-request-id') ?? undefined
      },
    },
  })

  if (!themeDuplicate) {
    // An unexpected error occurred during the GraphQL request execution
    recordError('Failed to duplicate theme')
    return {
      theme: undefined,
      userErrors: [{message: 'Failed to duplicate theme'}],
      requestId,
    }
  }

  const {newTheme, userErrors} = themeDuplicate

  if (userErrors.length > 0) {
    return {
      theme: undefined,
      userErrors,
      requestId,
    }
  }

  if (!newTheme) {
    // An unexpected error if neither theme nor userErrors are returned
    return {
      theme: undefined,
      userErrors: [{message: 'Failed to duplicate theme'}],
      requestId,
    }
  }

  const theme = buildTheme({
    id: parseGid(newTheme.id),
    name: newTheme.name,
    role: newTheme.role.toLowerCase(),
  })

  return {
    theme,
    userErrors: [],
    requestId,
  }
}

export async function metafieldDefinitionsByOwnerType(type: MetafieldOwnerType, session: AdminSession) {
  recordEvent('theme-api:fetch-metafield-definitions')
  const {metafieldDefinitions} = await adminRequestDoc({
    query: MetafieldDefinitionsByOwnerType,
    session,
    variables: {ownerType: type},
  })

  return metafieldDefinitions.nodes.map((definition) => ({
    key: definition.key,
    namespace: definition.namespace,
    name: definition.name,
    description: definition.description,
    type: {
      name: definition.type.name,
      category: definition.type.category,
    },
  }))
}

export async function passwordProtected(session: AdminSession): Promise<boolean> {
  recordEvent('theme-api:check-password-protection')
  const {onlineStore} = await adminRequestDoc({
    query: OnlineStorePasswordProtection,
    session,
  })
  if (!onlineStore) {
    unexpectedGraphQLError("Unable to get details about the storefront's password protection")
  }

  const {passwordProtection} = onlineStore

  return passwordProtection.enabled
}

function unexpectedGraphQLError(message: string): never {
  throw recordError(new AbortError(message))
}

function themeGid(id: number): string {
  return `gid://shopify/OnlineStoreTheme/${id}`
}

type OnlineStoreThemeFileBody =
  | {__typename: 'OnlineStoreThemeFileBodyBase64'; contentBase64: string}
  | {__typename: 'OnlineStoreThemeFileBodyText'; content: string}
  | {__typename: 'OnlineStoreThemeFileBodyUrl'; url: string}

export async function parseThemeFileContent(
  body: OnlineStoreThemeFileBody,
): Promise<{value?: string; attachment?: string}> {
  switch (body.__typename) {
    case 'OnlineStoreThemeFileBodyText':
      return {value: body.content}
    case 'OnlineStoreThemeFileBodyBase64':
      return {attachment: body.contentBase64}
    case 'OnlineStoreThemeFileBodyUrl':
      try {
        // eslint-disable-next-line no-restricted-globals
        const response = await fetch(body.url)

        const arrayBuffer = await response.arrayBuffer()
        return {attachment: Buffer.from(arrayBuffer).toString('base64')}
      } catch (error) {
        // Raise error if we can't download the file
        throw recordError(new AbortError(`Error downloading content from URL: ${body.url}`))
      }
  }
}
