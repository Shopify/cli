import {composeThemeGid, parseGid, DEVELOPMENT_THEME_ROLE} from './utils.js'
import {ThemeUpdate} from '../../../cli/api/graphql/admin/generated/theme_update.js'
import {ThemeDelete} from '../../../cli/api/graphql/admin/generated/theme_delete.js'
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
import {adminRequestDoc} from '@shopify/cli-kit/node/api/admin'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {Result, Checksum, Key, Theme, ThemeAsset, Operation} from '@shopify/cli-kit/node/themes/types'
import {outputDebug} from '@shopify/cli-kit/node/output'

export type ThemeParams = Partial<Pick<Theme, 'name' | 'role' | 'processing' | 'src'>>
export type AssetParams = Pick<ThemeAsset, 'key'> & Partial<Pick<ThemeAsset, 'value' | 'attachment'>>
const SkeletonThemeCdn = 'https://cdn.shopify.com/static/online-store/theme-skeleton.zip'

export async function fetchTheme(id: number, session: AdminSession): Promise<Theme | undefined> {
  const gid = composeThemeGid(id)

  try {
    const {theme} = await adminRequestDoc(GetTheme, session, {id: gid}, undefined, {
      handleErrors: false,
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
  } catch (_error) {
    /**
     * Consumers of this and other theme APIs in this file expect either a theme
     * or `undefined`.
     *
     * Error handlers should not inspect GraphQL error messages directly, as
     * they are internationalized.
     */
    outputDebug(`Error fetching theme with ID: ${id}`)
  }
}

export async function fetchThemes(session: AdminSession): Promise<Theme[]> {
  const themes: Theme[] = []
  let after: string | null = null

  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const response = await adminRequestDoc(GetThemes, session, {after})
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
  const {themeCreate} = await adminRequestDoc(
    ThemeCreate,
    session,
    {
      name: params.name ?? '',
      source: themeSource,
      role: (params.role ?? DEVELOPMENT_THEME_ROLE).toUpperCase() as ThemeRole,
    },
    '2025-04',
  )

  if (!themeCreate) {
    unexpectedGraphQLError('Failed to create theme')
  }

  const {theme, userErrors} = themeCreate
  if (userErrors.length) {
    const userErrors = themeCreate.userErrors.map((error) => error.message).join(', ')
    throw new AbortError(userErrors)
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

  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const response = await adminRequestDoc(GetThemeFileBodies, session, {
      id: themeGid(id),
      filenames,
      after,
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

export async function deleteThemeAssets(id: number, filenames: Key[], session: AdminSession): Promise<Result[]> {
  const batchSize = 50
  const results: Result[] = []

  for (let i = 0; i < filenames.length; i += batchSize) {
    const batch = filenames.slice(i, i + batchSize)
    // eslint-disable-next-line no-await-in-loop
    const {themeFilesDelete} = await adminRequestDoc(ThemeFilesDelete, session, {
      themeId: composeThemeGid(id),
      files: batch,
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
  for (let i = 0; i < assets.length; i += 50) {
    const chunk = assets.slice(i, i + 50)
    const files = prepareFilesForUpload(chunk)
    // eslint-disable-next-line no-await-in-loop
    const uploadResults = await uploadFiles(id, files, session)
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
  return adminRequestDoc(ThemeFilesUpsert, session, {themeId: themeGid(themeId), files})
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
    })
  })

  userErrors.forEach((error) => {
    if (!error.filename) {
      unexpectedGraphQLError(`Error uploading theme files: ${error.message}`)
    }
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

export async function metafieldDefinitionsByOwnerType(type: MetafieldOwnerType, session: AdminSession) {
  const {metafieldDefinitions} = await adminRequestDoc(MetafieldDefinitionsByOwnerType, session, {
    ownerType: type,
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
  const {onlineStore} = await adminRequestDoc(OnlineStorePasswordProtection, session)
  if (!onlineStore) {
    unexpectedGraphQLError("Unable to get details about the storefront's password protection")
  }

  const {passwordProtection} = onlineStore

  return passwordProtection.enabled
}

function unexpectedGraphQLError(message: string): never {
  throw new AbortError(message)
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
    case 'OnlineStoreThemeFileBodyBase64':
      return Buffer.from(body.contentBase64, 'base64').toString()
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
