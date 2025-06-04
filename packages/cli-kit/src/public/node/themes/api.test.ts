import {
  themeCreate,
  themeDelete,
  fetchTheme,
  fetchThemes,
  ThemeParams,
  themeUpdate,
  themePublish,
  fetchChecksums,
  bulkUploadThemeAssets,
  AssetParams,
  deleteThemeAssets,
  parseThemeFileContent,
} from './api.js'
import {Operation} from './types.js'
import {ThemeDelete} from '../../../cli/api/graphql/admin/generated/theme_delete.js'
import {ThemeUpdate} from '../../../cli/api/graphql/admin/generated/theme_update.js'
import {ThemePublish} from '../../../cli/api/graphql/admin/generated/theme_publish.js'
import {ThemeCreate} from '../../../cli/api/graphql/admin/generated/theme_create.js'
import {GetThemeFileChecksums} from '../../../cli/api/graphql/admin/generated/get_theme_file_checksums.js'
import {ThemeFilesUpsert} from '../../../cli/api/graphql/admin/generated/theme_files_upsert.js'
import {ThemeFilesDelete} from '../../../cli/api/graphql/admin/generated/theme_files_delete.js'
import {GetThemes} from '../../../cli/api/graphql/admin/generated/get_themes.js'
import {GetTheme} from '../../../cli/api/graphql/admin/generated/get_theme.js'
import {adminRequestDoc, supportedApiVersions} from '../api/admin.js'
import {AbortError} from '../error.js'
import {test, vi, expect, describe, beforeEach} from 'vitest'
import {ClientError} from 'graphql-request'

vi.mock('@shopify/cli-kit/node/api/admin')
vi.mock('@shopify/cli-kit/node/system')
vi.stubGlobal('fetch', vi.fn())

const session = {token: 'token', storeFqdn: 'my-shop.myshopify.com', refresh: async () => {}}
const themeAccessSession = {...session, token: 'shptka_token'}
const sessions = {CLI: session, 'Theme Access': themeAccessSession}
const expectedApiOptions = expect.objectContaining({
  maxRetryTimeMs: 90000,
  timeoutMs: 90000,
  useAbortSignal: true,
  useNetworkLevelRetry: true,
})

describe('fetchTheme', () => {
  test('returns a store theme', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue({
      theme: {id: 'gid://shopify/OnlineStoreTheme/123', name: 'store theme 1', role: 'MAIN', processing: false},
    })

    // When
    const theme = await fetchTheme(123, session)

    // Then
    expect(adminRequestDoc).toHaveBeenCalledWith({
      query: GetTheme,
      session,
      variables: {id: 'gid://shopify/OnlineStoreTheme/123'},
      responseOptions: {handleErrors: false},
    })

    expect(theme).not.toBeNull()
    expect(theme!.id).toEqual(123)
    expect(theme!.name).toEqual('store theme 1')
    expect(theme!.processing).toBeFalsy()
  })

  test('returns undefined when a theme is not found', async () => {
    const errorResponse = {
      status: 200,
      errors: [{message: 'Tema não existe'} as any],
    }
    vi.mocked(adminRequestDoc).mockRejectedValue(new ClientError(errorResponse, {query: ''}))

    // When
    const theme = await fetchTheme(123, session)

    // Then
    expect(theme).toBeUndefined()
    expect(adminRequestDoc).toHaveBeenCalledWith({
      query: GetTheme,
      session,
      variables: {id: 'gid://shopify/OnlineStoreTheme/123'},
      responseOptions: {handleErrors: false},
    })
  })
})

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
    expect(adminRequestDoc).toHaveBeenCalledWith({
      query: GetThemes,
      session,
      variables: {after: null},
      responseOptions: {handleErrors: false},
    })
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
    expect(adminRequestDoc).toHaveBeenCalledWith({
      query: GetThemeFileChecksums,
      session,
      variables: {
        id: `gid://shopify/OnlineStoreTheme/${id}`,
        after: null,
      },
      responseOptions: {handleErrors: false},
      requestBehaviour: expectedApiOptions,
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

describe('themeCreate', () => {
  const id = 123
  const name = 'new theme'
  const role = 'unpublished'
  const params: ThemeParams = {name, role}

  test('creates a theme', async () => {
    // Given
    vi.mocked(adminRequestDoc).mockResolvedValueOnce({
      themeCreate: {
        theme: {
          id: `gid://shopify/OnlineStoreTheme/${id}`,
          name,
          role,
        },
        userErrors: [],
      },
    })

    // When
    const theme = await themeCreate(params, session)

    // Then
    expect(adminRequestDoc).toHaveBeenCalledWith({
      query: ThemeCreate,
      session,
      variables: {
        name: params.name,
        source: 'https://cdn.shopify.com/static/online-store/theme-skeleton.zip',
        role: 'UNPUBLISHED',
      },
      responseOptions: {handleErrors: false},
      requestBehaviour: expectedApiOptions,
    })
    expect(theme).not.toBeNull()
    expect(theme!.id).toEqual(id)
    expect(theme!.name).toEqual(name)
    expect(theme!.role).toEqual(role)
    expect(theme!.processing).toBeFalsy()
  })

  test('does not use skeletonThemeCdn when src is provided', async () => {
    // Given
    vi.mocked(adminRequestDoc).mockResolvedValueOnce({
      themeCreate: {
        theme: {
          id: `gid://shopify/OnlineStoreTheme/${id}`,
          name,
          role,
        },
        userErrors: [],
      },
    })

    // When
    const theme = await themeCreate({...params, src: 'https://example.com/theme.zip'}, session)

    // Then
    expect(adminRequestDoc).toHaveBeenCalledWith({
      query: ThemeCreate,
      session,
      variables: {
        name: params.name,
        source: 'https://example.com/theme.zip',
        role: 'UNPUBLISHED',
      },
      responseOptions: {handleErrors: false},
      requestBehaviour: expectedApiOptions,
    })
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
      expect(adminRequestDoc).toHaveBeenCalledWith({
        query: ThemeUpdate,
        session,
        variables: {
          id: `gid://shopify/OnlineStoreTheme/${id}`,
          input: {name},
        },
        requestBehaviour: expectedApiOptions,
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
    expect(adminRequestDoc).toHaveBeenCalledWith({
      query: ThemeUpdate,
      session,
      variables: {
        id: `gid://shopify/OnlineStoreTheme/${id}`,
        input: {},
      },
      requestBehaviour: expectedApiOptions,
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
      expect(adminRequestDoc).toHaveBeenCalledWith({
        query: ThemePublish,
        session,
        variables: {id: `gid://shopify/OnlineStoreTheme/${id}`},
        requestBehaviour: expectedApiOptions,
      })
      expect(theme).not.toBeNull()
      expect(theme!.id).toEqual(id)
      expect(theme!.name).toEqual(name)
      expect(theme!.role).toEqual(role)
    })
  }
})

describe('deleteThemeAssets', () => {
  test('deletes a theme asset', async () => {
    // Given
    const id = 123
    const key = 'snippets/product-variant-picker.liquid'

    vi.mocked(adminRequestDoc).mockResolvedValue({
      themeFilesDelete: {
        deletedThemeFiles: [{filename: key}],
        userErrors: [],
      },
    })

    // When
    const output = await deleteThemeAssets(id, [key], session)

    // Then
    expect(adminRequestDoc).toHaveBeenCalledWith({
      query: ThemeFilesDelete,
      session,
      variables: {
        themeId: `gid://shopify/OnlineStoreTheme/${id}`,
        files: [key],
      },
      requestBehaviour: expectedApiOptions,
    })
    expect(output).toEqual([{key, success: true, operation: 'DELETE'}])
  })

  test('returns success when attempting to delete nonexistent assets', async () => {
    // Given
    const id = 123
    const key = 'snippets/product-variant-picker.liquid'

    vi.mocked(adminRequestDoc).mockResolvedValue({
      themeFilesDelete: {
        deletedThemeFiles: [{filename: key}],
        userErrors: [],
      },
    })

    // When
    const output = await deleteThemeAssets(id, [key], session)

    // Then
    expect(adminRequestDoc).toHaveBeenCalledWith({
      query: ThemeFilesDelete,
      session,
      variables: {
        themeId: `gid://shopify/OnlineStoreTheme/${id}`,
        files: [key],
      },
      requestBehaviour: expectedApiOptions,
    })
    expect(output).toEqual([{key, success: true, operation: 'DELETE'}])
  })
})

describe('themeDelete', () => {
  for (const [sessionType, session] of Object.entries(sessions)) {
    test(`deletes a theme with graphql with a ${sessionType} session`, async () => {
      // Given
      const id = 123

      vi.mocked(adminRequestDoc).mockResolvedValue({
        themeDelete: {
          deletedThemeId: 'gid://shopify/OnlineStoreTheme/123',
          userErrors: [],
        },
      })

      // When
      const response = await themeDelete(id, session)

      // Then
      expect(adminRequestDoc).toHaveBeenCalledWith({
        query: ThemeDelete,
        session,
        variables: {id: `gid://shopify/OnlineStoreTheme/${id}`},
        requestBehaviour: expectedApiOptions,
      })
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
    expect(adminRequestDoc).toHaveBeenCalledWith({
      query: ThemeFilesUpsert,
      session,
      variables: {
        themeId: `gid://shopify/OnlineStoreTheme/${id}`,
        files: [
          {
            filename: 'snippets/product-variant-picker.liquid',
            body: {value: 'content', type: 'TEXT'},
          },
          {
            filename: 'templates/404.json',
            body: {value: 'to_be_replaced_with_hash', type: 'TEXT'},
          },
        ],
      },
      requestBehaviour: expect.objectContaining({
        maxRetryTimeMs: 90000,
        timeoutMs: 90000,
        useAbortSignal: true,
        useNetworkLevelRetry: true,
      }),
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
    expect(adminRequestDoc).toHaveBeenCalledWith({
      query: ThemeFilesUpsert,
      session,
      variables: {
        themeId: `gid://shopify/OnlineStoreTheme/${id}`,
        files: [
          {
            filename: 'snippets/product-variant-picker.liquid',
            body: {value: 'content', type: 'TEXT'},
          },
          {
            filename: 'templates/404.json',
            body: {value: 'to_be_replaced_with_hash', type: 'TEXT'},
          },
        ],
      },
      requestBehaviour: expect.objectContaining({
        maxRetryTimeMs: 90000,
        timeoutMs: 90000,
        useAbortSignal: true,
        useNetworkLevelRetry: true,
      }),
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

describe('parseThemeFileContent', () => {
  const normalContent = 'foo'
  const base64Content = Buffer.from(normalContent).toString('base64')

  describe('when the body type is OnlineStoreThemeFileBodyText', () => {
    test('returns the content field as a value', async () => {
      const body = {
        __typename: 'OnlineStoreThemeFileBodyText' as const,
        content: normalContent,
      }

      const parsedContent = await parseThemeFileContent(body)

      expect(parsedContent).toEqual({value: normalContent})
    })
  })

  describe('when the body type is OnlineStoreThemeFileBodyBase64', () => {
    test('returns the contentBase64 field as an attachment', async () => {
      const body = {
        __typename: 'OnlineStoreThemeFileBodyBase64' as const,
        contentBase64: base64Content,
      }

      const parsedContent = await parseThemeFileContent(body)

      expect(parsedContent).toEqual({attachment: base64Content})
    })
  })

  describe('when the body type is OnlineStoreThemeFileBodyUrl', () => {
    beforeEach(() => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(normalContent, {
          headers: {'Content-Type': 'application/javascript'},
        }),
      )
    })

    test('fetches the content from the url and returns it as an attachment', async () => {
      const body = {
        __typename: 'OnlineStoreThemeFileBodyUrl' as const,
        url: 'https://example.com/foo',
      }

      const parsedContent = await parseThemeFileContent(body)

      expect(parsedContent).toEqual({attachment: base64Content})
    })
  })
})
