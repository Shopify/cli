import {
  getDevelopmentTheme,
  setDevelopmentTheme,
  removeDevelopmentTheme,
  getREPLTheme,
  setREPLTheme,
  removeREPLTheme,
  getStorefrontPassword,
  setStorefrontPassword,
  removeStorefrontPassword,
  ThemeLocalStorageSchema,
  setThemeStore,
  extractShopName,
} from './local-storage.js'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {describe, expect, test} from 'vitest'

describe('local-storage', () => {
  const testCases = [
    {name: 'getDevelopmentTheme', func: getDevelopmentTheme},
    {
      name: 'setDevelopmentTheme',
      func: (storage: LocalStorage<ThemeLocalStorageSchema>) => setDevelopmentTheme('theme-id', storage),
    },
    {name: 'removeDevelopmentTheme', func: removeDevelopmentTheme},
    {name: 'getREPLTheme', func: getREPLTheme},
    {
      name: 'setREPLTheme',
      func: (storage: LocalStorage<ThemeLocalStorageSchema>) => setREPLTheme('repl-theme-id', storage),
    },
    {name: 'removeREPLTheme', func: removeREPLTheme},
    {name: 'getStorefrontPassword', func: getStorefrontPassword},
    {
      name: 'setStorefrontPassword',
      func: (storage: LocalStorage<ThemeLocalStorageSchema>) => setStorefrontPassword('password', storage),
    },
    {name: 'removeStorefrontPassword', func: removeStorefrontPassword},
  ]

  testCases.forEach(({name, func}) => {
    describe(name, () => {
      test('throws error when theme store is not set', async () => {
        await inTemporaryDirectory(async (cwd) => {
          const storage = new LocalStorage<ThemeLocalStorageSchema>({cwd})
          await expect(() => func(storage)).toThrow('Theme store is not set')
        })
      })

      test('does not throw error when theme store is set', async () => {
        await inTemporaryDirectory(async (cwd) => {
          const storage = new LocalStorage<ThemeLocalStorageSchema>({cwd})
          setThemeStore('test-store', storage)
          await expect(() => func(storage)).not.toThrow()
        })
      })
    })
  })
})

describe('extractShopName', () => {
  test('extracts shop name from store URL', () => {
    expect(extractShopName('http://my-store.myshopify.com')).toBe('my-store')
    expect(extractShopName('http://my-store.shopify.io')).toBe('my-store')
    expect(extractShopName('http://my-store.shop.dev')).toBe('my-store')
    expect(extractShopName('http://my-store.spin.dev')).toBe('my-store')

    expect(extractShopName('https://my-store.myshopify.com')).toBe('my-store')
    expect(extractShopName('https://my-store.shopify.io')).toBe('my-store')
    expect(extractShopName('https://my-store.shop.dev')).toBe('my-store')
    expect(extractShopName('https://my-store.spin.dev')).toBe('my-store')
  })
})
