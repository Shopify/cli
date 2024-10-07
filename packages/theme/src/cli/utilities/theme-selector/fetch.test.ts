import {fetchStoreThemes, publicFetchStoreThemes} from './fetch.js'
import {fetchThemes} from '@shopify/cli-kit/node/themes/api'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {test, vi, describe, expect} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'

const session = {token: 'token', storeFqdn: 'my-shop.myshopify.com'}

vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('@shopify/cli-kit/node/session')

// This function serves as a wrapper around fetchStoreThemes
// which allows library users to pass a password to authenticate with the Theme API.
describe('publicFetchStoreThemes', () => {
  test('authenticates and fetches themes', async () => {
    // Given
    const store = 'my-store'
    const password = 'password123'
    vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(session)
    vi.mocked(fetchThemes).mockResolvedValue([theme(1, 'unpublished'), theme(2, 'live'), theme(3, 'unpublished')])

    // When
    await publicFetchStoreThemes(store, password)

    // Then
    expect(ensureAuthenticatedThemes).toHaveBeenCalledWith(store, password)
    expect(fetchThemes).toHaveBeenCalledWith(session)
  })
})

describe('fetchStoreThemes', () => {
  test('returns only allowed themes', async () => {
    // Given
    vi.mocked(fetchThemes).mockResolvedValue([
      theme(1, 'unpublished'),
      theme(2, 'demo'),
      theme(3, 'live'),
      theme(4, 'unpublished'),
      theme(5, 'development'),
      theme(6, 'demo'),
      theme(7, 'development'),
    ])

    // When
    const themes = await fetchStoreThemes(session)

    // Then
    expect(themes).toHaveLength(5)
    expect(themes[0]!.name).toBe('theme 3')
    expect(themes[1]!.name).toBe('theme 1')
    expect(themes[2]!.name).toBe('theme 4')
    expect(themes[3]!.name).toBe('theme 5')
    expect(themes[4]!.name).toBe('theme 7')
  })

  test('throws an error when there are no themes', async () => {
    // Given
    vi.mocked(fetchThemes).mockResolvedValue([])

    await expect(async () => {
      // When
      await fetchStoreThemes(session)

      // Then
    }).rejects.toThrowError(AbortError)
  })
})

function theme(id: number, role: string) {
  return {id, role, name: `theme ${id}`} as Theme
}
