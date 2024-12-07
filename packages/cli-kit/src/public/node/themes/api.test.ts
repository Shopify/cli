import {
  createTheme,
  themeDelete,
  fetchThemes,
  ThemeParams,
  themeUpdate,
  themePublish,
  fetchChecksums,
  bulkUploadThemeAssets,
  AssetParams,
  deleteThemeAsset,
} from './api.js'
import {Operation} from './types.js'
import {ThemeDelete} from '../../../cli/api/graphql/admin/generated/theme_delete.js'
import {ThemeUpdate} from '../../../cli/api/graphql/admin/generated/theme_update.js'
import {ThemePublish} from '../../../cli/api/graphql/admin/generated/theme_publish.js'
import {GetThemeFileChecksums} from '../../../cli/api/graphql/admin/generated/get_theme_file_checksums.js'
import {ThemeFilesUpsert} from '../../../cli/api/graphql/admin/generated/theme_files_upsert.js'
import {OnlineStoreThemeFileBodyInputType} from '../../../cli/api/graphql/admin/generated/types.js'
import {GetThemes} from '../../../cli/api/graphql/admin/generated/get_themes.js'
import {test, vi, expect, describe} from 'vitest'
import {adminRequestDoc, restRequest, supportedApiVersions} from '@shopify/cli-kit/node/api/admin'
import {AbortError} from '@shopify/cli-kit/node/error'

vi.mock('@shopify/cli-kit/node/api/admin')
vi.mock('@shopify/cli-kit/node/system')

const session = {token: 'token', storeFqdn: 'my-shop.myshopify.com', refresh: async () => {}}
const themeAccessSession = {...session, token: 'shptka_token'}
const sessions = {CLI: session, 'Theme Access': themeAccessSession}

describe('fetchThemes', () => {
  test('returns store themes', async () => {
    // Given
    vi.mocked(adminRequestDoc).mockResolvedValue({
      themes: {
        nodes: [
          {id: 'gid://shopify/OnlineStoreTheme/123', name: 'store theme 1', role: 'UNPUBLISHED', processing: false},
          {id: 'gid://shopify/OnlineStoreTheme/456', name: 'store theme 2', role: 'MAIN', processing: true},
        ],
        pageInfo: {hasNextPage: false, endCursor: null},
      },
    })

    // When
    const themes = await fetchThemes(session)

    // Then
    expect(adminRequestDoc).toHaveBeenCalledWith(GetThemes, session, {after: null})
    expect(themes).toHaveLength(2)

    expect(themes[0]!.id).toEqual(123)
    expect(themes[1]!.id).toEqual(456)

    expect(themes[0]!.name).toEqual('store theme 1')
    expect(themes[1]!.name).toEqual('store theme 2')

    expect(themes[0]!.processing).toBeFalsy()
    expect(themes[1]!.processing).toBeTruthy()
  })
})

describe('fetchChecksums', () => {
  test('returns theme checksums', async () => {
    // Given
    vi.mocked(supportedApiVersions).mockResolvedValue(['2024-10'])
    vi.mocked(adminRequestDoc).mockResolvedValue({
      theme: {
        files: {
          nodes: [
            {
              filename: 'snippets/product-variant-picker.liquid',
              checksumMd5: '29e2e56057c3b58c02bc7946d7600481',
            },
            {
              filename: 'templates/404.json',
              checksumMd5: 'f14a0bd594f4fee47b13fc09543098ff',
            },
            {
              filename: 'templates/article.json',
              checksumMd5: null,
            },
          ],
          pageInfo: {hasNextPage: false, endCursor: null},
        },
      },
    })

    // When
    const id = 123
    const checksum = await fetchChecksums(id, session)

    // Then
    expect(adminRequestDoc).toHaveBeenCalledWith(GetThemeFileChecksums, session, {
      id: `gid://shopify/OnlineStoreTheme/${id}`,
      after: null,
    })
    expect(checksum).toHaveLength(3)
    expect(checksum[0]!.key).toEqual('snippets/product-variant-picker.liquid')
    expect(checksum[1]!.key).toEqual('templates/404.json')
    expect(checksum[2]!.key).toEqual('templates/article.json')
    expect(checksum[0]!.checksum).toEqual('29e2e56057c3b58c02bc7946d7600481')
    expect(checksum[1]!.checksum).toEqual('f14a0bd594f4fee47b13fc09543098ff')
    expect(checksum[2]!.checksum).toEqual(null)
  })
})

describe('createTheme', () => {
  const id = 123
  const name = 'new theme'
  const role = 'unpublished'
  const processing = false
  const params: ThemeParams = {name, role}

  test('creates a theme', async () => {
    // Given
    vi.mocked(restRequest).mockResolvedValueOnce({
      json: {theme: {id, name, role, processing}},
      status: 200,
      headers: {},
    })

    vi.mocked(adminRequestDoc).mockResolvedValue({
      themeFilesUpsert: {
        upsertedThemeFiles: [],
        userErrors: [],
      },
    })

    // When
    const theme = await createTheme(params, session)

    // Then
    expect(restRequest).toHaveBeenCalledWith('POST', '/themes', session, {theme: params}, {})
    expect(theme).not.toBeNull()
    expect(theme!.id).toEqual(id)
    expect(theme!.name).toEqual(name)
    expect(theme!.role).toEqual(role)
    expect(theme!.processing).toBeFalsy()
  })

  test('does not upload minimum theme assets when src is provided', async () => {
    // Given
    vi.mocked(restRequest)
      .mockResolvedValueOnce({
        json: {theme: {id, name, role, processing}},
        status: 200,
        headers: {},
      })
      .mockResolvedValueOnce({
        json: {
          results: [],
        },
        status: 207,
        headers: {},
      })

    // When
    const theme = await createTheme({...params, src: 'https://example.com/theme.zip'}, session)

    // Then
    expect(restRequest).toHaveBeenCalledWith(
      'POST',
      '/themes',
      session,
      {theme: {...params, src: 'https://example.com/theme.zip'}},
      {},
    )
    expect(restRequest).not.toHaveBeenCalledWith('PUT', `/themes/${id}/assets/bulk`, session, undefined, {})
  })
})

describe('themeUpdate', () => {
  for (const [sessionType, session] of Object.entries(sessions)) {
    test(`updates a theme with graphql with a ${sessionType} session`, async () => {
      // Given
      const id = 123
      const name = 'updated theme'
      const role = 'unpublished'
      const params: ThemeParams = {name, role}

      vi.mocked(adminRequestDoc).mockResolvedValue({
        themeUpdate: {
          theme: {
            id: `gid://shopify/OnlineStoreTheme/${id}`,
            name,
            role,
          },
          userErrors: [],
        },
      })

      // When
      const theme = await themeUpdate(id, params, session)

      // Then
      expect(adminRequestDoc).toHaveBeenCalledWith(ThemeUpdate, session, {
        id: `gid://shopify/OnlineStoreTheme/${id}`,
        input: {name},
      })
      expect(theme).not.toBeNull()
      expect(theme!.id).toEqual(id)
      expect(theme!.name).toEqual(name)
      expect(theme!.role).toEqual(role)
    })
  }

  test('no-ops when input hash is empty', async () => {
    // Given
    const id = 123
    const name = 'theme'
    const role = 'unpublished'

    vi.mocked(adminRequestDoc).mockResolvedValue({
      themeUpdate: {
        theme: {
          id: `gid://shopify/OnlineStoreTheme/${id}`,
          name,
          role,
        },
        userErrors: [],
      },
    })

    // When
    const theme = await themeUpdate(id, {}, session)

    // Then
    expect(adminRequestDoc).toHaveBeenCalledWith(ThemeUpdate, session, {
      id: `gid://shopify/OnlineStoreTheme/${id}`,
      input: {},
    })
    expect(theme).not.toBeNull()
    expect(theme!.id).toEqual(id)
    expect(theme!.name).toEqual(name)
    expect(theme!.role).toEqual(role)
  })
})

describe('themePublish', () => {
  for (const [sessionType, session] of Object.entries(sessions)) {
    test(`publish a theme with graphql with a ${sessionType} session`, async () => {
      // Given
      const id = 123
      const name = 'updated theme'
      const role = 'live'

      vi.mocked(adminRequestDoc).mockResolvedValue({
        themePublish: {
          theme: {
            id: `gid://shopify/OnlineStoreTheme/${id}`,
            name,
            role,
          },
          userErrors: [],
        },
      })

      // When
      const theme = await themePublish(id, session)

      // Then
      expect(adminRequestDoc).toHaveBeenCalledWith(ThemePublish, session, {id: `gid://shopify/OnlineStoreTheme/${id}`})
      expect(theme).not.toBeNull()
      expect(theme!.id).toEqual(id)
      expect(theme!.name).toEqual(name)
      expect(theme!.role).toEqual(role)
    })
  }
})

describe('deleteThemeAsset', () => {
  test('deletes a theme asset', async () => {
    // Given
    const id = 123
    const key = 'snippets/product-variant-picker.liquid'

    vi.mocked(restRequest).mockResolvedValue({
      json: {message: 'snippets/product-variant-picker.liquid was succesfully deleted'},
      status: 200,
      headers: {},
    })

    // When
    const output = await deleteThemeAsset(id, key, session)

    // Then
    expect(restRequest).toHaveBeenCalledWith('DELETE', `/themes/${id}/assets`, session, undefined, {'asset[key]': key})
    expect(output).toBe(true)
  })

  test('returns true when attemping to delete an nonexistent asset', async () => {
    // Given
    const id = 123
    const key = 'snippets/product-variant-picker.liquid'

    vi.mocked(restRequest).mockResolvedValue({
      json: {},
      status: 200,
      headers: {},
    })

    // When
    const output = await deleteThemeAsset(id, key, session)

    // Then
    expect(restRequest).toHaveBeenCalledWith('DELETE', `/themes/${id}/assets`, session, undefined, {'asset[key]': key})
    expect(output).toBe(true)
  })

  test('throws an AbortError when the server responds with a 403', async () => {
    // Given
    const id = 123
    const key = 'config/settings_data.json'
    const message = 'You are not authorized to edit themes on "my-shop.myshopify.com".'

    vi.mocked(restRequest).mockResolvedValue({
      json: {message},
      status: 403,
      headers: {},
    })

    // When
    const deletePromise = () => deleteThemeAsset(id, key, session)

    // Then
    await expect(deletePromise).rejects.toThrow(new AbortError(message))
    expect(restRequest).toHaveBeenCalledWith('DELETE', `/themes/${id}/assets`, session, undefined, {'asset[key]': key})
  })
})

describe('themeDelete', () => {
  for (const [sessionType, session] of Object.entries(sessions)) {
    test(`deletes a theme with graphql with a ${sessionType} session`, async () => {
      // Given
      const id = 123
      const name = 'store theme'

      vi.mocked(adminRequestDoc).mockResolvedValue({
        themeDelete: {
          deletedThemeId: 'gid://shopify/OnlineStoreTheme/123',
          userErrors: [],
        },
      })

      // When
      const response = await themeDelete(id, session)

      // Then
      expect(adminRequestDoc).toHaveBeenCalledWith(ThemeDelete, session, {id: `gid://shopify/OnlineStoreTheme/${id}`})
      expect(response).toBe(true)
    })
  }
})

describe('request errors', () => {
  test(`returns AbortError when graphql returns user error`, async () => {
    // Given
    vi.mocked(adminRequestDoc).mockResolvedValue({
      themeDelete: {
        deletedThemeId: null,
        userErrors: [{message: 'Could not delete theme'}],
      },
    })

    await expect(async () => {
      // When
      return themeDelete(1, session)

      // Then
    }).rejects.toThrowError(AbortError)
  })
})

describe('bulkUploadThemeAssets', async () => {
  test('uploads multiple TEXT and BASE64 assets', async () => {
    const id = 123
    const assets: AssetParams[] = [
      {key: 'snippets/product-variant-picker.liquid', value: 'content'},
      {
        key: 'templates/404.json',
        value: 'to_be_replaced_with_hash',
      },
    ]

    vi.mocked(adminRequestDoc).mockResolvedValue({
      themeFilesUpsert: {
        upsertedThemeFiles: [{filename: 'snippets/product-variant-picker.liquid'}, {filename: 'templates/404.json'}],
        userErrors: [],
      },
    })

    // When
    const bulkUploadresults = await bulkUploadThemeAssets(id, assets, session)

    // Then
    expect(adminRequestDoc).toHaveBeenCalledWith(ThemeFilesUpsert, session, {
      themeId: `gid://shopify/OnlineStoreTheme/${id}`,
      files: [
        {
          filename: 'snippets/product-variant-picker.liquid',
          body: {value: 'content', type: 'TEXT' as OnlineStoreThemeFileBodyInputType},
        },
        {
          filename: 'templates/404.json',
          body: {value: 'to_be_replaced_with_hash', type: 'TEXT' as OnlineStoreThemeFileBodyInputType},
        },
      ],
    })

    expect(bulkUploadresults).toEqual([
      {
        key: 'snippets/product-variant-picker.liquid',
        success: true,
        operation: Operation.Upload,
      },
      {
        key: 'templates/404.json',
        success: true,
        operation: Operation.Upload,
      },
    ])
  })

  test('throws an error when returns userErrors with filenames', async () => {
    const id = 123
    const assets: AssetParams[] = [
      {key: 'snippets/product-variant-picker.liquid', value: 'content'},
      {
        key: 'templates/404.json',
        value: 'to_be_replaced_with_hash',
      },
    ]

    vi.mocked(adminRequestDoc).mockResolvedValue({
      themeFilesUpsert: {
        upsertedThemeFiles: [],
        userErrors: [
          {filename: 'snippets/product-variant-picker.liquid', message: 'Something went wrong'},
          {filename: 'templates/404.json', message: 'Something went wrong'},
        ],
      },
    })

    // When
    const bulkUploadresults = await bulkUploadThemeAssets(id, assets, session)

    // Then
    expect(adminRequestDoc).toHaveBeenCalledWith(ThemeFilesUpsert, session, {
      themeId: `gid://shopify/OnlineStoreTheme/${id}`,
      files: [
        {
          filename: 'snippets/product-variant-picker.liquid',
          body: {value: 'content', type: 'TEXT' as OnlineStoreThemeFileBodyInputType},
        },
        {
          filename: 'templates/404.json',
          body: {value: 'to_be_replaced_with_hash', type: 'TEXT' as OnlineStoreThemeFileBodyInputType},
        },
      ],
    })

    expect(bulkUploadresults).toEqual([
      {
        key: 'snippets/product-variant-picker.liquid',
        success: false,
        operation: Operation.Upload,
        errors: {asset: ['Something went wrong']},
      },
      {
        key: 'templates/404.json',
        success: false,
        operation: Operation.Upload,
        errors: {asset: ['Something went wrong']},
      },
    ])
  })

  test('throws an error when returns userErrors with no filename', async () => {
    const id = 123
    const assets: AssetParams[] = [
      {key: 'snippets/product-variant-picker.liquid', value: 'content'},
      {
        key: 'templates/404.json',
        value: 'to_be_replaced_with_hash',
      },
    ]

    vi.mocked(adminRequestDoc).mockResolvedValue({
      themeFilesUpsert: {
        upsertedThemeFiles: [],
        userErrors: [{message: 'Something went wrong'}],
      },
    })

    await expect(bulkUploadThemeAssets(id, assets, session)).rejects.toThrow(AbortError)
    await expect(bulkUploadThemeAssets(id, assets, session)).rejects.toThrow(
      'Error uploading theme files: Something went wrong',
    )
  })
})
