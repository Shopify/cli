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
  getThemeStore,
  useThemeStoreContext,
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

  describe('getThemeStore', () => {
    test('selects store from context when inside useThemeStoreContext', async () => {
      await inTemporaryDirectory(async (cwd) => {
        const storage = new LocalStorage<ThemeLocalStorageSchema>({cwd})
        setThemeStore('storage-store.myshopify.com', storage)

        const initialStore = getThemeStore(storage)
        let insideContextStore: string | undefined

        await useThemeStoreContext('context-store.myshopify.com', async () => {
          insideContextStore = getThemeStore(storage)
        })

        const outsideContextStore = getThemeStore(storage)

        expect(initialStore).toBe('storage-store.myshopify.com')
        expect(outsideContextStore).toBe('storage-store.myshopify.com')
        expect(insideContextStore).toBe('context-store.myshopify.com')
      })
    })

    test('ensures concurrently run commands maintain their own store value', async () => {
      await inTemporaryDirectory(async (cwd) => {
        const storage = new LocalStorage<ThemeLocalStorageSchema>({cwd})
        setThemeStore('storage-store.myshopify.com', storage)

        const results: {[key: string]: string | undefined} = {}

        await Promise.all([
          useThemeStoreContext('store1.myshopify.com', async () => {
            await new Promise((resolve) => setTimeout(resolve, 10))
            results.env1 = getThemeStore(storage)
          }),
          useThemeStoreContext('store2.myshopify.com', async () => {
            await new Promise((resolve) => setTimeout(resolve, 5))
            results.env2 = getThemeStore(storage)
          }),
          useThemeStoreContext('store3.myshopify.com', async () => {
            results.env3 = getThemeStore(storage)
          }),
          (results.env4 = getThemeStore(storage)),
        ])

        expect(results.env1).toBe('store1.myshopify.com')
        expect(results.env2).toBe('store2.myshopify.com')
        expect(results.env3).toBe('store3.myshopify.com')
        expect(results.env4).toBe('storage-store.myshopify.com')
      })
    })
  })
})
