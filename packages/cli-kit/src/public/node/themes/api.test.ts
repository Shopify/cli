import {
  createTheme,
  deleteTheme,
  fetchThemes,
  ThemeParams,
  updateTheme,
  publishTheme,
  upgradeTheme,
  fetchChecksums,
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
