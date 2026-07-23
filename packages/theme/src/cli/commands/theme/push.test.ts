import Push from './push.js'
import {loadThemeProjectTrust} from '../../utilities/theme-airlock/config.js'
import {ThemeAirlockError} from '../../utilities/theme-airlock/types.js'
import {DevelopmentThemeManager} from '../../utilities/development-theme-manager.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import {createOrSelectTheme, push} from '../../services/push.js'
import {
  getDevelopmentTheme,
  getThemeStore,
  setDevelopmentTheme,
  setThemeStore,
  useThemeStoreContext,
} from '../../services/local-storage.js'
import {Config} from '@oclif/core'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {joinPath} from '@shopify/cli-kit/node/path'
import {ensureAuthenticatedThemes, setLastSeenUserId} from '@shopify/cli-kit/node/session'
import {
  getCurrentStoredStoreAppSession,
  listCurrentStoredStoreAppSessions,
} from '@shopify/cli-kit/node/store-auth-session'
import {renderConcurrent, renderInfo} from '@shopify/cli-kit/node/ui'
import {beforeEach, describe, expect, test, vi} from 'vitest'

import type {ThemeLocalStorageSchema} from '../../services/local-storage.js'

const pushMock = vi.hoisted(() => vi.fn())
const localStorageState = vi.hoisted(() => ({
  theme: undefined as LocalStorage<ThemeLocalStorageSchema> | undefined,
  development: undefined as LocalStorage<Record<string, string>> | undefined,
  setThemeStore: vi.fn<(store: string) => void>(),
}))

vi.mock('../../utilities/theme-airlock/config.js')
vi.mock('../../utilities/theme-store.js')
vi.mock('../../services/push.js', async () => {
  const actual = await vi.importActual<typeof import('../../services/push.js')>('../../services/push.js')
  return {...actual, push: pushMock}
})
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/store-auth-session')
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
  const developmentThemeStore = () => {
    const storage = themeStorage()
    const store = actual.getThemeStore(storage)
    if (store) return store
    actual.getDevelopmentTheme(storage)
    throw new Error('Expected getDevelopmentTheme to require a theme store')
  }

  return {
    ...actual,
    getThemeStore: () => actual.getThemeStore(themeStorage()),
    setThemeStore: localStorageState.setThemeStore,
    getDevelopmentTheme: () => developmentStorage().get(developmentThemeStore()),
    setDevelopmentTheme: (theme: string) => developmentStorage().set(developmentThemeStore(), theme),
    removeDevelopmentTheme: () => developmentStorage().delete(developmentThemeStore()),
  }
})

const CommandConfig = new Config({root: __dirname})
const trustedStore = 'trusted-store.myshopify.com'
const adminSession = {token: 'test-token', storeFqdn: trustedStore}
const developmentTheme = {id: 1, name: 'Development', role: 'development', createdAtRuntime: false}

async function run(args: string[]) {
  await CommandConfig.load()
  const command = new Push(args, CommandConfig)
  return command.run()
}

async function runFrom(root: string, args: string[]) {
  vi.stubEnv('INIT_CWD', root)
  try {
    return await run(args)
  } finally {
    vi.unstubAllEnvs()
  }
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
  await Promise.all([mkdir(themeStoragePath), mkdir(developmentStoragePath)])
  localStorageState.theme = new LocalStorage<ThemeLocalStorageSchema>({cwd: themeStoragePath})
  localStorageState.development = new LocalStorage<Record<string, string>>({cwd: developmentStoragePath})
  localStorageState.setThemeStore.mockImplementation((store) => localStorageState.theme?.set('themeStore', store))
}

async function createConfiguredTheme(themePath: string) {
  await writeFile(joinPath(themePath, 'shopify.theme.toml'), `[environments.default]\nstore = "${trustedStore}"\n`)
}

interface BatchEnvironment {
  name: string
  store: string
  password: string
  theme: string
}

async function createBatchProject(root: string, environments: BatchEnvironment[]) {
  const rootConfiguration: string[] = []

  for (const environment of environments) {
    const themePath = joinPath(root, environment.name)
    // eslint-disable-next-line no-await-in-loop
    await mkdir(themePath)
    // eslint-disable-next-line no-await-in-loop
    await writeFile(
      joinPath(themePath, 'shopify.theme.toml'),
      `[environments.${environment.name}]\nstore = "${environment.store}"\n`,
    )
    rootConfiguration.push(
      `[environments.${environment.name}]`,
      `store = "${environment.store}"`,
      `password = "${environment.password}"`,
      `path = ${JSON.stringify(themePath)}`,
      `theme = "${environment.theme}"`,
      '',
    )
  }

  await writeFile(joinPath(root, 'shopify.theme.toml'), rootConfiguration.join('\n'))
}

async function executeConcurrentProcesses(options: Parameters<typeof renderConcurrent>[0]) {
  const abortController = new AbortController()
  await Promise.all(
    options.processes.map((outputProcess) =>
      outputProcess.action(process.stdout, process.stderr, abortController.signal),
    ),
  )
}

describe('theme push', () => {
  beforeEach(() => {
    vi.spyOn(DevelopmentThemeManager.prototype, 'findOrCreate').mockResolvedValue(developmentTheme as never)
    vi.mocked(loadThemeProjectTrust).mockRejectedValue(
      new ThemeAirlockError('Theme project trust is blocked', 'unconfigured-project'),
    )
    vi.mocked(ensureThemeStore).mockReturnValue(adminSession.storeFqdn)
    vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(adminSession)
    vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue(undefined)
    vi.mocked(listCurrentStoredStoreAppSessions).mockReturnValue([])
    vi.mocked(push).mockResolvedValue(undefined)
  })

  test.each([
    {name: 'without force', args: []},
    {name: 'with force', args: ['--force']},
  ])('blocks before upload lifecycle $name', async ({args}) => {
    await expect(run(['--store=test-store.myshopify.com', ...args])).rejects.toMatchObject({
      reason: 'unconfigured-project',
    })

    expect(loadThemeProjectTrust).toHaveBeenCalledOnce()
    expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
    expect(ensureThemeStore).not.toHaveBeenCalled()
    expect(setThemeStore).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
    expect(renderConcurrent).not.toHaveBeenCalled()
  })

  test('runs preflight before pushing a trusted target without changing the remembered store', async () => {
    await inTemporaryDirectory(async (themePath) => {
      await initializeLocalStorage(themePath)
      await createConfiguredTheme(themePath)
      await useActualProtectedLifecycle()
      const rememberedStore = 'other-store.myshopify.com'
      localStorageState.theme?.set('themeStore', rememberedStore)
      const events: string[] = []
      vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue({
        store: trustedStore,
        clientId: 'store-auth-client-id',
        userId: 'user-id',
        accessToken: 'read-only-token',
        scopes: ['read_themes'],
        acquiredAt: '2026-07-23T00:00:00.000Z',
      })
      vi.mocked(ensureAuthenticatedThemes).mockImplementation(async (store) => {
        events.push(`authenticate:${store}`)
        return adminSession
      })
      vi.mocked(renderInfo).mockImplementation((options) => {
        if (options.headline === 'Theme Airlock') events.push('preflight')
        return undefined
      })
      vi.mocked(push).mockImplementation(async () => {
        events.push('push')
      })

      await run(['--path', themePath, '--theme', '123'])

      expect(events).toEqual([`authenticate:${trustedStore}`, 'preflight', 'push'])
      expect(ensureAuthenticatedThemes).toHaveBeenCalledWith(trustedStore, undefined)
      expect(push).toHaveBeenCalledWith(expect.objectContaining({store: trustedStore}), adminSession, false, undefined)
      expect(vi.mocked(push).mock.calls[0]?.[1]).toBe(adminSession)
      expect(setLastSeenUserId).not.toHaveBeenCalled()
      expect(setThemeStore).not.toHaveBeenCalled()
      expect(getThemeStore()).toBe(rememberedStore)
    })
  })

  test('uses trusted development-theme state for a development push', async () => {
    await inTemporaryDirectory(async (themePath) => {
      await initializeLocalStorage(themePath)
      await createConfiguredTheme(themePath)
      await useActualProtectedLifecycle()
      const rememberedStore = 'other-store.myshopify.com'
      localStorageState.theme?.set('themeStore', rememberedStore)
      await useThemeStoreContext(rememberedStore, async () => setDevelopmentTheme('other-development-theme'))
      await useThemeStoreContext(trustedStore, async () => setDevelopmentTheme('trusted-development-theme'))

      let observedDevelopmentTheme: string | undefined
      vi.spyOn(DevelopmentThemeManager.prototype, 'findOrCreate').mockImplementation(async function (
        this: DevelopmentThemeManager,
      ) {
        observedDevelopmentTheme = (this as unknown as {themeId: string | undefined}).themeId
        return developmentTheme as never
      })
      vi.mocked(push).mockImplementation(async (flags, session, multiEnvironment) => {
        if (!session) throw new Error('Expected the Push command to supply an AdminSession')
        await createOrSelectTheme(session, flags, multiEnvironment)
      })

      await run(['--path', themePath, '--password', 'theme-password', '--development'])

      expect(observedDevelopmentTheme).toBe('trusted-development-theme')
      expect(push).toHaveBeenCalledWith(
        expect.objectContaining({development: true, store: trustedStore}),
        adminSession,
        false,
        undefined,
      )
      expect(getThemeStore()).toBe(rememberedStore)
      await useThemeStoreContext(rememberedStore, async () => {
        expect(getDevelopmentTheme()).toBe('other-development-theme')
      })
      expect(setThemeStore).not.toHaveBeenCalled()
    })
  })

  test('authenticates a trusted same-store batch before sequential pushes', async () => {
    await inTemporaryDirectory(async (root) => {
      await initializeLocalStorage(root)
      await useActualProtectedLifecycle()
      const environments = [
        {name: 'first', store: trustedStore, password: 'first-password', theme: '101'},
        {name: 'second', store: trustedStore, password: 'second-password', theme: '102'},
      ]
      await createBatchProject(root, environments)
      const events: string[] = []
      const sessionsByPassword = new Map<string, typeof adminSession>()
      const observedStores: string[] = []
      vi.mocked(ensureAuthenticatedThemes).mockImplementation(async (store, password) => {
        events.push(`authenticate:${password}`)
        const session = {token: password ?? '', storeFqdn: store}
        sessionsByPassword.set(password ?? '', session)
        return session
      })
      vi.mocked(renderConcurrent).mockImplementation(async (options) => {
        const [outputProcess] = options.processes
        if (!outputProcess) throw new Error('Expected one sequential Push process')
        events.push(`group:${outputProcess.prefix}`)
        const abortController = new AbortController()
        await outputProcess.action(process.stdout, process.stderr, abortController.signal)
      })
      vi.mocked(push).mockImplementation(async (flags) => {
        const environment = flags.environment?.[0]
        events.push(`push:start:${environment}`)
        observedStores.push(getThemeStore() ?? '')
        await Promise.resolve()
        events.push(`push:end:${environment}`)
      })

      await runFrom(root, ['--environment', 'first', '--environment', 'second', '--force'])

      expect(events).toEqual([
        'authenticate:first-password',
        'authenticate:second-password',
        'group:first',
        'push:start:first',
        'push:end:first',
        'group:second',
        'push:start:second',
        'push:end:second',
      ])
      expect(renderConcurrent).toHaveBeenCalledTimes(2)
      expect(
        vi.mocked(renderConcurrent).mock.calls.map(([options]) => options.processes.map(({prefix}) => prefix)),
      ).toEqual([['first'], ['second']])
      expect(observedStores).toEqual([trustedStore, trustedStore])
      expect(vi.mocked(push).mock.calls[0]?.[1]).toBe(sessionsByPassword.get('first-password'))
      expect(vi.mocked(push).mock.calls[1]?.[1]).toBe(sessionsByPassword.get('second-password'))
      expect(setThemeStore).not.toHaveBeenCalled()
    })
  })

  test('authenticates a trusted distinct-store batch before one concurrent push group', async () => {
    await inTemporaryDirectory(async (root) => {
      await initializeLocalStorage(root)
      await useActualProtectedLifecycle()
      const firstStore = 'first-store.myshopify.com'
      const secondStore = 'second-store.myshopify.com'
      const environments = [
        {name: 'first', store: firstStore, password: 'first-password', theme: '201'},
        {name: 'second', store: secondStore, password: 'second-password', theme: '202'},
      ]
      await createBatchProject(root, environments)
      const events: string[] = []
      const sessionsByStore = new Map<string, typeof adminSession>()
      const observedStoresByEnvironment = new Map<string, string | undefined>()
      vi.mocked(ensureAuthenticatedThemes).mockImplementation(async (store, password) => {
        events.push(`authenticate:${store}`)
        const session = {token: password ?? '', storeFqdn: store}
        sessionsByStore.set(store, session)
        return session
      })
      vi.mocked(renderConcurrent).mockImplementation(async (options) => {
        events.push(`group:${options.processes.map(({prefix}) => prefix).join(',')}`)
        await executeConcurrentProcesses(options)
      })
      vi.mocked(push).mockImplementation(async (flags) => {
        const environment = flags.environment?.[0] ?? ''
        events.push(`push:start:${environment}`)
        observedStoresByEnvironment.set(environment, getThemeStore())
        await Promise.resolve()
        events.push(`push:end:${environment}`)
      })

      await runFrom(root, ['--environment', 'first', '--environment', 'second', '--force'])

      expect(events).toEqual([
        `authenticate:${firstStore}`,
        `authenticate:${secondStore}`,
        'group:first,second',
        'push:start:first',
        'push:start:second',
        'push:end:first',
        'push:end:second',
      ])
      expect(renderConcurrent).toHaveBeenCalledOnce()
      expect(vi.mocked(renderConcurrent).mock.calls[0]?.[0].processes.map(({prefix}) => prefix)).toEqual([
        'first',
        'second',
      ])
      expect(observedStoresByEnvironment).toEqual(
        new Map([
          ['first', firstStore],
          ['second', secondStore],
        ]),
      )
      expect(vi.mocked(push).mock.calls[0]?.[1]).toBe(sessionsByStore.get(firstStore))
      expect(vi.mocked(push).mock.calls[1]?.[1]).toBe(sessionsByStore.get(secondStore))
      expect(setThemeStore).not.toHaveBeenCalled()
    })
  })
})
