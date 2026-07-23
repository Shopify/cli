import Dev from './dev.js'
import {loadThemeProjectTrust} from '../../utilities/theme-airlock/config.js'
import {ThemeAirlockError} from '../../utilities/theme-airlock/types.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import {DevelopmentThemeManager} from '../../utilities/development-theme-manager.js'
import {dev} from '../../services/dev.js'
import {metafieldsPull} from '../../services/metafields-pull.js'
import {
  getDevelopmentTheme,
  getStorefrontPassword,
  getThemeStore,
  setDevelopmentTheme,
  setStorefrontPassword,
  setThemeStore,
  useThemeStoreContext,
} from '../../services/local-storage.js'
import {findOrSelectTheme} from '../../utilities/theme-selector.js'
import {ensureLiveThemeConfirmed} from '../../utilities/theme-ui.js'
import {Config} from '@oclif/core'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {joinPath} from '@shopify/cli-kit/node/path'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {renderConcurrent} from '@shopify/cli-kit/node/ui'
import {beforeEach, describe, expect, test, vi} from 'vitest'

import type {ThemeLocalStorageSchema} from '../../services/local-storage.js'

const localStorageState = vi.hoisted(() => ({
  theme: undefined as LocalStorage<ThemeLocalStorageSchema> | undefined,
  development: undefined as LocalStorage<Record<string, string>> | undefined,
  storefront: undefined as LocalStorage<Record<string, string>> | undefined,
  setThemeStore: vi.fn<(store: string) => void>(),
}))

vi.mock('../../utilities/theme-airlock/config.js')
vi.mock('../../utilities/theme-store.js')
vi.mock('../../services/dev.js')
vi.mock('../../services/metafields-pull.js')
vi.mock('../../utilities/theme-selector.js')
vi.mock('../../utilities/theme-ui.js')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('../../services/local-storage.js', async () => {
  const actual = await vi.importActual<typeof import('../../services/local-storage.js')>(
    '../../services/local-storage.js',
  )

  const themeStorage = () => {
    if (!localStorageState.theme) throw new Error('Theme storage is not initialized')
    return localStorageState.theme
  }
  const developmentStorage = () => {
    if (!localStorageState.development) throw new Error('Development theme storage is not initialized')
    return localStorageState.development
  }
  const storefrontStorage = () => {
    if (!localStorageState.storefront) throw new Error('Storefront password storage is not initialized')
    return localStorageState.storefront
  }
  const developmentThemeStore = () => {
    const storage = themeStorage()
    const store = actual.getThemeStore(storage)
    if (store) return store
    actual.getDevelopmentTheme(storage)
    throw new Error('Expected getDevelopmentTheme to require a theme store')
  }
  const storefrontPasswordStore = () => {
    const storage = themeStorage()
    const store = actual.getThemeStore(storage)
    if (store) return store
    actual.getStorefrontPassword(storage)
    throw new Error('Expected getStorefrontPassword to require a theme store')
  }

  return {
    ...actual,
    getThemeStore: () => actual.getThemeStore(themeStorage()),
    setThemeStore: localStorageState.setThemeStore,
    getDevelopmentTheme: () => developmentStorage().get(developmentThemeStore()),
    setDevelopmentTheme: (theme: string) => developmentStorage().set(developmentThemeStore(), theme),
    removeDevelopmentTheme: () => developmentStorage().delete(developmentThemeStore()),
    getStorefrontPassword: () => storefrontStorage().get(storefrontPasswordStore()),
    setStorefrontPassword: (password: string) => storefrontStorage().set(storefrontPasswordStore(), password),
    removeStorefrontPassword: () => storefrontStorage().delete(storefrontPasswordStore()),
  }
})

const CommandConfig = new Config({root: __dirname})
const trustedStore = 'trusted-store.myshopify.com'
const adminSession = {token: 'test-token', storeFqdn: trustedStore}
const developmentTheme = {id: 1, createdAtRuntime: false}

async function run(args: string[]) {
  await CommandConfig.load()
  const command = new Dev(args, CommandConfig)
  return command.run()
}

async function useActualProtectedLifecycle() {
  const [airlockConfig, themeStore] = await Promise.all([
    vi.importActual<typeof import('../../utilities/theme-airlock/config.js')>(
      '../../utilities/theme-airlock/config.js',
    ),
    vi.importActual<typeof import('../../utilities/theme-store.js')>('../../utilities/theme-store.js'),
  ])
  vi.mocked(loadThemeProjectTrust).mockImplementation(airlockConfig.loadThemeProjectTrust)
  vi.mocked(ensureThemeStore).mockImplementation(themeStore.ensureThemeStore)
}

async function initializeLocalStorage(root: string) {
  const themeStoragePath = joinPath(root, 'theme-storage')
  const developmentStoragePath = joinPath(root, 'development-storage')
  const storefrontStoragePath = joinPath(root, 'storefront-storage')
  await Promise.all([mkdir(themeStoragePath), mkdir(developmentStoragePath), mkdir(storefrontStoragePath)])
  localStorageState.theme = new LocalStorage<ThemeLocalStorageSchema>({cwd: themeStoragePath})
  localStorageState.development = new LocalStorage<Record<string, string>>({cwd: developmentStoragePath})
  localStorageState.storefront = new LocalStorage<Record<string, string>>({cwd: storefrontStoragePath})
  localStorageState.setThemeStore.mockImplementation((store) => localStorageState.theme?.set('themeStore', store))
}

async function createConfiguredTheme(themePath: string) {
  await writeFile(joinPath(themePath, 'shopify.theme.toml'), `[environments.default]\nstore = "${trustedStore}"\n`)
}

describe('theme dev', () => {
  beforeEach(() => {
    vi.spyOn(DevelopmentThemeManager.prototype, 'findOrCreate').mockResolvedValue(developmentTheme as never)
    vi.mocked(loadThemeProjectTrust).mockRejectedValue(
      new ThemeAirlockError('Theme project trust is blocked', 'unconfigured-project'),
    )
    vi.mocked(ensureThemeStore).mockReturnValue(adminSession.storeFqdn)
    vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(adminSession)
    vi.mocked(findOrSelectTheme).mockResolvedValue({id: 1} as never)
    vi.mocked(ensureLiveThemeConfirmed).mockResolvedValue(true)
    vi.mocked(dev).mockResolvedValue(undefined)
    vi.mocked(metafieldsPull).mockResolvedValue(undefined)
  })

  test('blocks before development lifecycle', async () => {
    await expect(run(['--store=test-store.myshopify.com'])).rejects.toMatchObject({reason: 'unconfigured-project'})

    expect(loadThemeProjectTrust).toHaveBeenCalledOnce()
    expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
    expect(ensureThemeStore).not.toHaveBeenCalled()
    expect(setThemeStore).not.toHaveBeenCalled()
    expect(dev).not.toHaveBeenCalled()
    expect(findOrSelectTheme).not.toHaveBeenCalled()
    expect(DevelopmentThemeManager.prototype.findOrCreate).not.toHaveBeenCalled()
    expect(ensureLiveThemeConfirmed).not.toHaveBeenCalled()
    expect(metafieldsPull).not.toHaveBeenCalled()
    expect(renderConcurrent).not.toHaveBeenCalled()
  })

  test('runs a trusted target in its store context without remembering it', async () => {
    await inTemporaryDirectory(async (themePath) => {
      await initializeLocalStorage(themePath)
      await createConfiguredTheme(themePath)
      await useActualProtectedLifecycle()
      let developmentThemeStore: string | undefined
      vi.spyOn(DevelopmentThemeManager.prototype, 'findOrCreate').mockImplementation(async () => {
        developmentThemeStore = getThemeStore()
        return developmentTheme as never
      })

      expect(getThemeStore()).toBeUndefined()

      await run(['--path', themePath, '--password', 'theme-password'])

      expect(ensureAuthenticatedThemes).toHaveBeenCalledWith(trustedStore, 'theme-password')
      expect(developmentThemeStore).toBe(trustedStore)
      expect(dev).toHaveBeenCalledWith(
        expect.objectContaining({adminSession, directory: themePath, store: trustedStore}),
      )
      expect(vi.mocked(dev).mock.calls[0]?.[0].adminSession).toBe(adminSession)
      expect(metafieldsPull).toHaveBeenCalledWith(expect.objectContaining({store: trustedStore}), adminSession)
      expect(vi.mocked(metafieldsPull).mock.calls[0]?.[1]).toBe(adminSession)
      expect(setThemeStore).not.toHaveBeenCalled()
      expect(getThemeStore()).toBeUndefined()
    })
  })

  test('keeps development state scoped to a trusted target instead of a different remembered store', async () => {
    await inTemporaryDirectory(async (themePath) => {
      await initializeLocalStorage(themePath)
      await createConfiguredTheme(themePath)
      await useActualProtectedLifecycle()
      const rememberedStore = 'other-store.myshopify.com'
      localStorageState.theme?.set('themeStore', rememberedStore)

      await useThemeStoreContext(rememberedStore, async () => {
        setDevelopmentTheme('other-development-theme')
        setStorefrontPassword('other-storefront-password')
      })
      await useThemeStoreContext(trustedStore, async () => {
        setDevelopmentTheme('trusted-development-theme')
        setStorefrontPassword('trusted-storefront-password')
      })

      let observedDevelopmentTheme: string | undefined
      let observedStorefrontPassword: string | undefined
      let observedStore: string | undefined
      vi.spyOn(DevelopmentThemeManager.prototype, 'findOrCreate').mockImplementation(async function (
        this: DevelopmentThemeManager,
      ) {
        observedDevelopmentTheme = (this as unknown as {themeId: string | undefined}).themeId
        return developmentTheme as never
      })
      vi.mocked(dev).mockImplementation(async () => {
        observedStore = getThemeStore()
        observedStorefrontPassword = getStorefrontPassword()
      })

      await run(['--path', themePath, '--password', 'theme-password'])

      expect(observedStore).toBe(trustedStore)
      expect(observedDevelopmentTheme).toBe('trusted-development-theme')
      expect(observedStorefrontPassword).toBe('trusted-storefront-password')
      expect(getThemeStore()).toBe(rememberedStore)
      await useThemeStoreContext(rememberedStore, async () => {
        expect(getDevelopmentTheme()).toBe('other-development-theme')
        expect(getStorefrontPassword()).toBe('other-storefront-password')
      })
      expect(setThemeStore).not.toHaveBeenCalled()
    })
  })
})
