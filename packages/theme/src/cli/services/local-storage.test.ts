import {requireThemeStore, setThemeStore, ThemeLocalStorageSchema} from './local-storage.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {describe, expect, test} from 'vitest'

describe('requireThemeStore', async () => {
  await inTemporaryDirectory(async (cwd) => {
    test('throws an error if the theme store is not set', async () => {
      // Given
      const storage = new LocalStorage<ThemeLocalStorageSchema>({cwd})

      // When
      // Then
      await expect(() => requireThemeStore(storage)).toThrowError(AbortError)
      await expect(() => requireThemeStore(storage)).toThrowError('Theme store is not set')
    })

    test('returns the theme store if it is set', async () => {
      // Given
      const storage = new LocalStorage<ThemeLocalStorageSchema>({cwd})
      setThemeStore('my-theme-store.myshopify.com', storage)

      // When
      const result = requireThemeStore(storage)

      // Then
      expect(result).toBe('my-theme-store.myshopify.com')
    })
  })
})
