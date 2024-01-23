import {
  createTheme,
  deleteTheme,
  fetchThemes,
  ThemeParams,
  updateTheme,
  publishTheme,
  upgradeTheme,
  fetchChecksums,
  bulkUploadThemeAssets,
  AssetParams,
  deleteThemeAsset,
} from './api.js'
import {test, vi, expect, describe} from 'vitest'
import {restRequest} from '@shopify/cli-kit/node/api/admin'
import {AbortError} from '@shopify/cli-kit/node/error'

vi.mock('@shopify/cli-kit/node/api/admin')

const session = {token: 'token', storeFqdn: 'my-shop.myshopify.com'}

describe('fetchThemes', () => {
  test('returns store themes', async () => {
    // Given
    vi.mocked(restRequest).mockResolvedValue({
      json: {
        themes: [
          {id: 123, name: 'store theme 1', processing: false},
          {id: 456, name: 'store theme 2', processing: true},
        ],
      },
      status: 200,
      headers: {},
    })

    // When
    const themes = await fetchThemes(session)

    // Then
    expect(restRequest).toHaveBeenCalledWith('GET', '/themes', session, undefined, {fields: 'id,name,role,processing'})
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
    vi.mocked(restRequest).mockResolvedValue({
      json: {
        assets: [
          {
            key: 'snippets/product-variant-picker.liquid',
            checksum: '29e2e56057c3b58c02bc7946d7600481',
          },
          {
            key: 'templates/404.json',
            checksum: 'f14a0bd594f4fee47b13fc09543098ff',
          },
          {
            key: 'templates/article.json',
            // May be null if an asset has not been updated recently.
            checksum: null,
          },
        ],
      },
      status: 200,
      headers: {},
    })

    // When
    const id = 123
    const checksum = await fetchChecksums(id, session)

    // Then
    expect(restRequest).toHaveBeenCalledWith('GET', `/themes/${id}/assets`, session, undefined, {
      fields: 'key,checksum',
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
  test('creates a theme', async () => {
    // Given
    const id = 123
    const name = 'new theme'
    const role = 'unpublished'
    const processing = false
    const params: ThemeParams = {name, role}

    vi.mocked(restRequest).mockResolvedValue({
      json: {theme: {id, name, role, processing}},
      status: 200,
      headers: {},
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
})

describe('upgradeTheme', () => {
  test('upgrades a theme with a script', async () => {
    // Given
    const fromTheme = 123
    const toTheme = 456
    const id = 789
    const name = 'updated-theme'
    const role = 'unpublished'

    vi.mocked(restRequest).mockResolvedValue({
      json: {theme: {id, name, role}},
      status: 200,
      headers: {},
    })

    // When
    const theme = await upgradeTheme({fromTheme, toTheme, session})

    // Then
    expect(restRequest).toHaveBeenCalledWith('POST', `/themes`, session, {from_theme: fromTheme, to_theme: toTheme}, {})
    expect(theme).not.toBeNull()
    expect(theme!.id).toEqual(id)
    expect(theme!.name).toEqual(name)
    expect(theme!.role).toEqual(role)
  })

  test('upgrades a theme without a script', async () => {
    // Given
    const fromTheme = 123
    const toTheme = 456
    const script = 'update_extension.json contents'
    const id = 789
    const name = 'updated-theme'
    const role = 'unpublished'

    vi.mocked(restRequest).mockResolvedValue({
      json: {theme: {id, name, role}},
      status: 200,
      headers: {},
    })

    // When
    const theme = await upgradeTheme({fromTheme, toTheme, script, session})

    // Then
    expect(restRequest).toHaveBeenCalledWith(
      'POST',
      `/themes`,
      session,
      {from_theme: fromTheme, to_theme: toTheme, script},
      {},
    )
    expect(theme).not.toBeNull()
    expect(theme!.id).toEqual(id)
    expect(theme!.name).toEqual(name)
    expect(theme!.role).toEqual(role)
  })
})

describe('updateTheme', () => {
  test('updates a theme', async () => {
    // Given
    const id = 123
    const name = 'updated theme'
    const role = 'unpublished'
    const params: ThemeParams = {name, role}

    vi.mocked(restRequest).mockResolvedValue({
      json: {theme: {id, name, role}},
      status: 200,
      headers: {},
    })

    // When
    const theme = await updateTheme(id, params, session)

    // Then
    expect(restRequest).toHaveBeenCalledWith('PUT', `/themes/${id}`, session, {theme: {id, ...params}}, {})
    expect(theme).not.toBeNull()
    expect(theme!.id).toEqual(id)
    expect(theme!.name).toEqual(name)
    expect(theme!.role).toEqual(role)
  })
})

describe('publishTheme', () => {
  test('publish a theme', async () => {
    // Given
    const id = 123
    const name = 'updated theme'
    const role = 'live'

    vi.mocked(restRequest).mockResolvedValue({
      json: {theme: {id, name, role}},
      status: 200,
      headers: {},
    })

    // When
    const theme = await publishTheme(id, session)

    // Then
    expect(restRequest).toHaveBeenCalledWith('PUT', `/themes/${id}`, session, {theme: {id, role: 'main'}}, {})
    expect(theme).not.toBeNull()
    expect(theme!.id).toEqual(id)
    expect(theme!.name).toEqual(name)
    expect(theme!.role).toEqual(role)
  })
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

  test('returns empty object when attemping to delete an nonexistent asset', async () => {
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
    expect(output).toBe(false)
  })
})

describe('deleteTheme', () => {
  test('deletes a theme', async () => {
    // Given
    const id = 123
    const name = 'store theme'

    vi.mocked(restRequest).mockResolvedValue({
      json: {theme: {id, name}},
      status: 200,
      headers: {},
    })

    // When
    const theme = await deleteTheme(id, session)

    // Then
    expect(restRequest).toHaveBeenCalledWith('DELETE', `/themes/${id}`, session, undefined, {})
    expect(theme).not.toBeNull()
    expect(theme!.id).toEqual(id)
    expect(theme!.name).toEqual('store theme')
  })
})

describe('request errors', () => {
  const httpErrors = [401, 403, 500, 999]

  httpErrors.forEach((httpError) => {
    test(`${httpError} errors`, async () => {
      // Given
      vi.mocked(restRequest).mockResolvedValue({
        json: {},
        status: httpError,
        headers: {},
      })

      await expect(async () => {
        // When
        return deleteTheme(1, session)

        // Then
      }).rejects.toThrowError(AbortError)
    })
  })
})

describe('bulkUploadThemeAssets', async () => {
  test('uploads multiple assets', async () => {
    const id = 123
    const assets: AssetParams[] = [
      {key: 'snippets/product-variant-picker.liquid', value: 'content'},
      {key: 'templates/404.json', value: 'content'},
    ]

    const mockResults = [
      {
        code: 200,
        body: {
          asset: {
            key: 'assets/test.liquid',
            public_url: 'https://cdn.shopify.com/dummy_url',
            created_at: '2024-01-24T16:26:13-08:00',
            updated_at: '2024-01-24T16:26:13-08:00',
            content_type: 'application/x-liquid',
            size: 20,
            checksum: '3f26c8569292ce6f1cc991c5fa7d3fcb',
            theme_id: 139503010036,
            warnings: [],
          },
        },
      },
      {
        code: 400,
        body: {
          errors: {
            value: 'expected Hash to be a String',
          },
        },
      },
    ]

    vi.mocked(restRequest).mockResolvedValue({
      json: {results: mockResults},
      status: 207,
      headers: {},
    })

    // When
    const bulkUploadresults = await bulkUploadThemeAssets(id, assets, session)

    // Then
    expect(restRequest).toHaveBeenCalledWith(
      'PUT',
      `/themes/${id}/assets/bulk`,
      session,
      {
        assets: [
          {key: 'snippets/product-variant-picker.liquid', value: 'content'},
          {key: 'templates/404.json', value: 'content'},
        ],
      },
      {},
    )
    expect(bulkUploadresults).toHaveLength(2)
    expect(bulkUploadresults[0]).toEqual({
      key: 'assets/test.liquid',
      success: true,
      errors: {},
      asset: {
        key: 'assets/test.liquid',
        public_url: 'https://cdn.shopify.com/dummy_url',
        created_at: '2024-01-24T16:26:13-08:00',
        updated_at: '2024-01-24T16:26:13-08:00',
        content_type: 'application/x-liquid',
        size: 20,
        checksum: '3f26c8569292ce6f1cc991c5fa7d3fcb',
        theme_id: 139503010036,
        warnings: [],
      },
    })
    expect(bulkUploadresults[1]).toEqual({
      key: undefined,
      success: false,
      errors: {value: 'expected Hash to be a String'},
      asset: undefined,
    })
  })
})
