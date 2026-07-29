import Add from './add.js'
import {themeAirlockAdd} from '../../../services/theme-airlock-add.js'
import {getThemeStore, setThemeStore} from '../../../services/local-storage.js'
import {configurationFileName} from '../../../constants.js'
import {Config} from '@oclif/core'
import {authAliasFlag} from '@shopify/cli-kit/node/cli'
import {inTemporaryDirectory, mkdir, readFile, readdir} from '@shopify/cli-kit/node/fs'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {joinPath} from '@shopify/cli-kit/node/path'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {beforeEach, describe, expect, test, vi} from 'vitest'

import type {ThemeLocalStorageSchema} from '../../../services/local-storage.js'

const localStorageState = vi.hoisted(() => ({
  storage: undefined as LocalStorage<ThemeLocalStorageSchema> | undefined,
  setThemeStore: vi.fn<(store: string) => void>(),
}))

vi.mock('../../../services/theme-airlock-add.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/theme-airlock-add.js')>()
  return {...actual, themeAirlockAdd: vi.fn(actual.themeAirlockAdd)}
})
vi.mock('../../../services/local-storage.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/local-storage.js')>()
  const storage = () => {
    if (!localStorageState.storage) throw new Error('Theme storage is not initialized')
    return localStorageState.storage
  }

  return {
    ...actual,
    getThemeStore: () => actual.getThemeStore(storage()),
    setThemeStore: localStorageState.setThemeStore,
  }
})
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/ui')

const CommandConfig = new Config({root: __dirname})
const serviceResult = {
  environment: 'preview',
  store: 'trusted-store.myshopify.com',
  configurationPath: '/theme/shopify.theme.toml',
}

async function runCommand(argv: string[]) {
  await CommandConfig.load()
  const command = new Add(argv, CommandConfig)
  return command.run()
}

describe('theme airlock add', () => {
  beforeEach(() => {
    vi.mocked(themeAirlockAdd).mockResolvedValue(serviceResult)
  })

  test('rejects a missing store argument before calling the service', async () => {
    await expect(runCommand(['--path', '/theme', '--environment', 'preview'])).rejects.toThrow()

    expect(themeAirlockAdd).not.toHaveBeenCalled()
    expect(renderSuccess).not.toHaveBeenCalled()
  })

  test('rejects a missing environment flag before calling the service', async () => {
    await expect(runCommand(['trusted-store', '--path', '/theme'])).rejects.toThrow()

    expect(themeAirlockAdd).not.toHaveBeenCalled()
    expect(renderSuccess).not.toHaveBeenCalled()
  })

  test('passes parsed arguments and flags to the service without applying business logic', async () => {
    await inTemporaryDirectory(async (themePath) => {
      await runCommand([
        'https://TRUSTED-STORE.myshopify.com/admin/',
        '--path',
        themePath,
        '--environment',
        ' preview ',
        '--password',
        'shptka_secret',
      ])

      expect(themeAirlockAdd).toHaveBeenCalledOnce()
      expect(themeAirlockAdd).toHaveBeenCalledWith({
        themePath,
        environment: ' preview ',
        store: 'https://TRUSTED-STORE.myshopify.com/admin/',
        password: 'shptka_secret',
      })
    })
  })

  test('renders success from the service result', async () => {
    await inTemporaryDirectory(async (themePath) => {
      await runCommand(['trusted-store', '--path', themePath, '--environment', 'preview'])

      expect(renderSuccess).toHaveBeenCalledWith({
        headline: 'Store added to Theme Airlock.',
        body: [
          'Environment: preview',
          'Store: trusted-store.myshopify.com',
          'Configuration: /theme/shopify.theme.toml',
        ],
      })
    })
  })

  test('leaves remembered-store storage byte-for-byte unchanged without calling setThemeStore', async () => {
    await inTemporaryDirectory(async (root) => {
      const themePath = joinPath(root, 'theme')
      const storagePath = joinPath(root, 'storage')
      await Promise.all([mkdir(themePath), mkdir(storagePath)])
      localStorageState.storage = new LocalStorage<ThemeLocalStorageSchema>({cwd: storagePath})
      const rememberedStore = 'remembered-store.myshopify.com'
      localStorageState.storage.set('themeStore', rememberedStore)
      const [storageFileName] = await readdir(storagePath)
      if (!storageFileName) throw new Error('Expected remembered-store storage to exist')
      const storageFilePath = joinPath(storagePath, storageFileName)
      const originalStorage = await readFile(storageFilePath)
      const actualService = await vi.importActual<typeof import('../../../services/theme-airlock-add.js')>(
        '../../../services/theme-airlock-add.js',
      )
      vi.mocked(themeAirlockAdd).mockImplementation(actualService.themeAirlockAdd)
      vi.mocked(ensureAuthenticatedThemes).mockResolvedValue({
        token: 'test-token',
        storeFqdn: 'trusted-store.myshopify.com',
      })

      await runCommand(['trusted-store', '--path', themePath, '--environment', 'preview'])

      expect(getThemeStore()).toBe(rememberedStore)
      await expect(readFile(storageFilePath)).resolves.toBe(originalStorage)
      expect(setThemeStore).not.toHaveBeenCalled()
      await expect(readFile(joinPath(themePath, configurationFileName))).resolves.toContain(
        '[environments.preview]\nstore = "trusted-store.myshopify.com"',
      )
    })
  })

  test('exposes the standard auth-alias base flag', () => {
    expect(Add.baseFlags).toBe(authAliasFlag)
  })
})
