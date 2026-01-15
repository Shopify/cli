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
  getThemeDevSession,
  setThemeDevSession,
  removeThemeDevSession,
  getActiveThemeDevSession,
  isProcessRunning,
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

  describe('isProcessRunning', () => {
    test('returns true for current process', () => {
      expect(isProcessRunning(process.pid)).toBe(true)
    })

    test('returns false for non-existent process', () => {
      // Use a very high PID that's unlikely to exist
      expect(isProcessRunning(999999999)).toBe(false)
    })
  })

  describe('theme dev sessions', () => {
    test('setThemeDevSession and getThemeDevSession store and retrieve session', () => {
      const directory = '/test/directory'
      const session = {
        pid: 12345,
        port: 9292,
        store: 'test.myshopify.com',
        startedAt: Date.now(),
        themeId: '123',
      }

      setThemeDevSession(directory, session)
      const retrieved = getThemeDevSession(directory)

      expect(retrieved).toEqual(session)

      // Cleanup
      removeThemeDevSession(directory)
    })

    test('removeThemeDevSession removes the session', () => {
      const directory = '/test/directory/remove'
      const session = {
        pid: 12345,
        port: 9292,
        store: 'test.myshopify.com',
        startedAt: Date.now(),
        themeId: '123',
      }

      setThemeDevSession(directory, session)
      removeThemeDevSession(directory)
      const retrieved = getThemeDevSession(directory)

      expect(retrieved).toBeUndefined()
    })

    test('getThemeDevSession returns undefined for non-existent directory', () => {
      const retrieved = getThemeDevSession('/non/existent/directory')
      expect(retrieved).toBeUndefined()
    })

    test('getActiveThemeDevSession returns session when process is running', () => {
      const directory = '/test/directory/active'
      // Use current process PID so it's definitely running
      const session = {
        pid: process.pid,
        port: 9292,
        store: 'test.myshopify.com',
        startedAt: Date.now(),
        themeId: '123',
      }

      setThemeDevSession(directory, session)
      const retrieved = getActiveThemeDevSession(directory)

      expect(retrieved).toEqual(session)

      // Cleanup
      removeThemeDevSession(directory)
    })

    test('getActiveThemeDevSession returns undefined and cleans up stale session', () => {
      const directory = '/test/directory/stale'
      // Use a non-existent PID to simulate a stale session
      const session = {
        pid: 999999999,
        port: 9292,
        store: 'test.myshopify.com',
        startedAt: Date.now(),
        themeId: '123',
      }

      setThemeDevSession(directory, session)
      const retrieved = getActiveThemeDevSession(directory)

      // Should return undefined because process isn't running
      expect(retrieved).toBeUndefined()

      // Should have cleaned up the stale session
      const afterCleanup = getThemeDevSession(directory)
      expect(afterCleanup).toBeUndefined()
    })
  })
})
