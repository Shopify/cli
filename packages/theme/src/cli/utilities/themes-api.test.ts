import {createTheme, deleteTheme, fetchThemes, ThemeParams, updateTheme, publishTheme} from './themes-api.js'
import {test, vi, expect, describe} from 'vitest'
import {error} from '@shopify/cli-kit'
import {restRequest} from '@shopify/cli-kit/node/api/admin'

vi.mock('@shopify/cli-kit')
vi.mock('@shopify/cli-kit/node/api/admin')

const session = {token: 'token', storeFqdn: 'my-shop.myshopify.com'}

describe('fetchThemes', () => {
  test('returns store themes', async () => {
    // Given
    vi.mocked(restRequest).mockResolvedValue({
      json: {
        themes: [
          {id: 123, name: 'store theme 1'},
          {id: 456, name: 'store theme 2'},
        ],
      },
      status: 200,
      headers: {},
    })

    // When
    const themes = await fetchThemes(session)

    // Then
    expect(restRequest).toHaveBeenCalledWith('GET', '/themes', session, undefined, {fields: 'id,name,role'})
    expect(themes).toHaveLength(2)

    expect(themes[0]!.id).toEqual(123)
    expect(themes[1]!.id).toEqual(456)

    expect(themes[0]!.name).toEqual('store theme 1')
    expect(themes[1]!.name).toEqual('store theme 2')
  })
})

describe('createTheme', () => {
  test('creates a theme', async () => {
    // Given
    const id = 123
    const name = 'new theme'
    const role = 'unpublished'
    const params: ThemeParams = {name, role}

    vi.mocked(restRequest).mockResolvedValue({
      json: {theme: {id, name, role}},
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
      }).rejects.toThrowError(error.Abort)
    })
  })
})
