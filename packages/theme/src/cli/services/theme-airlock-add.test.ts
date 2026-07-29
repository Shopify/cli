import {themeAirlockAdd} from './theme-airlock-add.js'
import {getThemeStore, setThemeStore} from './local-storage.js'
import {addTrustedThemeEnvironment} from '../utilities/theme-airlock/writer.js'
import {ThemeAirlockError} from '../utilities/theme-airlock/types.js'
import {configurationFileName} from '../constants.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExistsSync, inTemporaryDirectory, mkdir, readFile, readdir, writeFile} from '@shopify/cli-kit/node/fs'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {joinPath} from '@shopify/cli-kit/node/path'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {beforeEach, describe, expect, test, vi} from 'vitest'

import type {ThemeLocalStorageSchema} from './local-storage.js'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('../utilities/theme-airlock/writer.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utilities/theme-airlock/writer.js')>()
  return {...actual, addTrustedThemeEnvironment: vi.fn(actual.addTrustedThemeEnvironment)}
})

const normalizedStore = 'trusted-store.myshopify.com'
const session = {token: 'test-token', storeFqdn: normalizedStore}

async function createTheme(root: string): Promise<string> {
  const themePath = joinPath(root, 'theme')
  await mkdir(themePath)
  return themePath
}

async function writeConfiguration(themePath: string, content: string): Promise<string> {
  const configurationPath = joinPath(themePath, configurationFileName)
  await writeFile(configurationPath, content)
  return configurationPath
}

describe('themeAirlockAdd', () => {
  beforeEach(() => {
    vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(session)
  })

  test('trims the environment and normalizes the store', async () => {
    await inTemporaryDirectory(async (root) => {
      const themePath = await createTheme(root)
      const configurationPath = joinPath(themePath, configurationFileName)

      await expect(
        themeAirlockAdd({
          themePath,
          environment: ' preview ',
          store: 'https://TRUSTED-STORE.myshopify.com/admin/',
        }),
      ).resolves.toEqual({environment: 'preview', store: normalizedStore, configurationPath})

      expect(ensureAuthenticatedThemes).toHaveBeenCalledWith(normalizedStore, undefined)
      await expect(readFile(configurationPath)).resolves.toContain(
        '[environments.preview]\nstore = "trusted-store.myshopify.com"',
      )
    })
  })

  test('rejects an empty environment before authentication or writing', async () => {
    await inTemporaryDirectory(async (root) => {
      const themePath = await createTheme(root)

      await expect(themeAirlockAdd({themePath, environment: ' \t ', store: normalizedStore})).rejects.toMatchObject({
        reason: 'invalid-environment',
        message: expect.stringContaining("Environment name to add can't be empty"),
      })

      expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
      expect(fileExistsSync(joinPath(themePath, configurationFileName))).toBe(false)
    })
  })

  test('preserves the invalid store AbortError from normalization', async () => {
    await inTemporaryDirectory(async (root) => {
      const themePath = await createTheme(root)
      const result = themeAirlockAdd({themePath, environment: 'preview', store: 'not a store'})

      await expect(result).rejects.toBeInstanceOf(AbortError)
      await expect(result).rejects.not.toBeInstanceOf(ThemeAirlockError)
      await expect(result).rejects.toMatchObject({message: 'Invalid store value: not a store'})
      expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
      expect(fileExistsSync(joinPath(themePath, configurationFileName))).toBe(false)
    })
  })

  test('forwards the password exactly', async () => {
    await inTemporaryDirectory(async (root) => {
      const themePath = await createTheme(root)

      await themeAirlockAdd({
        themePath,
        environment: 'preview',
        store: normalizedStore,
        password: 'shptka_secret',
      })

      expect(ensureAuthenticatedThemes).toHaveBeenCalledWith(normalizedStore, 'shptka_secret')
    })
  })

  test('authenticates before calling the writer', async () => {
    await inTemporaryDirectory(async (root) => {
      const themePath = await createTheme(root)
      const events: string[] = []
      vi.mocked(ensureAuthenticatedThemes).mockImplementation(async () => {
        events.push('authenticate')
        return session
      })
      vi.mocked(addTrustedThemeEnvironment).mockImplementation(async () => {
        events.push('write')
        return {path: joinPath(themePath, configurationFileName), store: normalizedStore}
      })

      await themeAirlockAdd({themePath, environment: 'preview', store: normalizedStore})

      expect(events).toEqual(['authenticate', 'write'])
    })
  })

  test('leaves an existing configuration unchanged when authentication fails', async () => {
    await inTemporaryDirectory(async (root) => {
      const themePath = await createTheme(root)
      const original = '# Existing trust\nname = "theme"\n'
      const configurationPath = await writeConfiguration(themePath, original)
      vi.mocked(ensureAuthenticatedThemes).mockRejectedValue(new Error('authentication failed'))

      await expect(themeAirlockAdd({themePath, environment: 'preview', store: normalizedStore})).rejects.toThrow(
        'authentication failed',
      )

      expect(addTrustedThemeEnvironment).not.toHaveBeenCalled()
      await expect(readFile(configurationPath)).resolves.toBe(original)
    })
  })

  test.each([
    {
      name: 'environment conflict',
      original: '[environments.preview]\nstore = "other-store.myshopify.com"\n',
      reason: 'environment-conflict',
    },
    {
      name: 'store conflict',
      original: '[environments.default]\nstore = "trusted-store.myshopify.com"\n',
      reason: 'store-conflict',
    },
  ])('propagates a $name without changing the configuration', async ({original, reason}) => {
    await inTemporaryDirectory(async (root) => {
      const themePath = await createTheme(root)
      const configurationPath = await writeConfiguration(themePath, original)

      await expect(themeAirlockAdd({themePath, environment: 'preview', store: normalizedStore})).rejects.toMatchObject({
        reason,
      })

      expect(ensureAuthenticatedThemes).toHaveBeenCalledOnce()
      await expect(readFile(configurationPath)).resolves.toBe(original)
    })
  })

  test('leaves remembered-store storage byte-for-byte unchanged', async () => {
    await inTemporaryDirectory(async (root) => {
      const themePath = await createTheme(root)
      const storagePath = joinPath(root, 'storage')
      await mkdir(storagePath)
      const storage = new LocalStorage<ThemeLocalStorageSchema>({cwd: storagePath})
      const rememberedStore = 'remembered-store.myshopify.com'
      setThemeStore(rememberedStore, storage)
      const [storageFileName] = await readdir(storagePath)
      if (!storageFileName) throw new Error('Expected remembered-store storage to exist')
      const storageFilePath = joinPath(storagePath, storageFileName)
      const originalStorage = await readFile(storageFilePath)

      await themeAirlockAdd({themePath, environment: 'preview', store: normalizedStore})

      expect(getThemeStore(storage)).toBe(rememberedStore)
      await expect(readFile(storageFilePath)).resolves.toBe(originalStorage)
    })
  })
})
