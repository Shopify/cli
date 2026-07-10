import {ensureThemeStore} from './theme-store.js'
import {getThemeStore, setThemeStore} from '../services/local-storage.js'
import {describe, expect, test, vi} from 'vitest'
import {recordError} from '@shopify/cli-kit/node/analytics'

vi.mock('../services/local-storage.js')
vi.mock('@shopify/cli-kit/node/analytics')

vi.mocked(recordError).mockImplementation((error) => error)

describe('ensureThemeStore', () => {
  test('returns the store from flags if provided and sets it in local storage', () => {
    // Given
    const flags = {store: 'example.myshopify.com'}

    // When
    const result = ensureThemeStore(flags)

    // Then
    expect(result).toBe('example.myshopify.com')
    expect(setThemeStore).toHaveBeenCalledWith('example.myshopify.com')
  })

  test('returns the store from local storage if flag is not provided', () => {
    // Given
    const flags = {store: undefined}
    vi.mocked(getThemeStore).mockReturnValue('stored.myshopify.com')

    // When
    const result = ensureThemeStore(flags)

    // Then
    expect(result).toBe('stored.myshopify.com')
    expect(setThemeStore).toHaveBeenCalledWith('stored.myshopify.com')
  })

  test('throws AbortError if store is not provided and not in local storage', () => {
    // Given
    const flags = {store: undefined}
    vi.mocked(getThemeStore).mockReturnValue(undefined)

    // When / Then
    expect(() => ensureThemeStore(flags)).toThrow('A store is required')
  })
})
