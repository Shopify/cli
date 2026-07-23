import {ThemeAirlockCoordinator} from './coordinator.js'
import {getThemeStore, setThemeStore} from '../../services/local-storage.js'
import {configurationFileName} from '../../constants.js'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi} from 'vitest'

import type {ThemeLocalStorageSchema} from '../../services/local-storage.js'
import type {AdminSession} from '@shopify/cli-kit/node/session'

const trustedStore = 'trusted.myshopify.com'
const session: AdminSession = {token: 'theme-token', storeFqdn: trustedStore}

type CoordinatorOptions = ConstructorParameters<typeof ThemeAirlockCoordinator>[0]

async function createConfiguredTheme(root: string): Promise<string> {
  const themePath = joinPath(root, 'theme')
  await mkdir(themePath)
  await writeFile(joinPath(themePath, configurationFileName), `[environments.default]\nstore = "${trustedStore}"\n`)
  return themePath
}

async function createBatchTheme(root: string, environment: string, store: string): Promise<string> {
  const themePath = joinPath(root, environment)
  await mkdir(themePath)
  await writeFile(joinPath(themePath, configurationFileName), `[environments.${environment}]\nstore = "${store}"\n`)
  return themePath
}

async function createStorage(root: string): Promise<LocalStorage<ThemeLocalStorageSchema>> {
  const storagePath = joinPath(root, 'storage')
  await mkdir(storagePath)
  return new LocalStorage<ThemeLocalStorageSchema>({cwd: storagePath})
}

function createCoordinator(
  storage: LocalStorage<ThemeLocalStorageSchema>,
  overrides: Partial<CoordinatorOptions> = {},
) {
  return new ThemeAirlockCoordinator({
    argv: [],
    env: {},
    authenticate: async (flags) => ({token: 'theme-token', storeFqdn: flags.store as string}),
    rememberedStore: () => getThemeStore(storage),
    supportsPrompting: () => false,
    renderPreflight: vi.fn(),
    storedSessionsFor: vi.fn(() => new Map()),
    storedSessionFromCache: vi.fn(),
    missingRequiredFlags: vi.fn(() => []),
    ...overrides,
  })
}

function environment(name: string, path: string, store: string, password?: string) {
  const suppliedFlags = {...(password === undefined ? {} : {password}), store}
  return {
    environment: name,
    flags: {...suppliedFlags, path},
    validationFlags: suppliedFlags,
    requiresAuth: true,
  }
}

describe('ThemeAirlockCoordinator', () => {
  describe('runSingle', () => {
    test('executes with the trusted store without changing a different remembered store', async () => {
      await inTemporaryDirectory(async (root) => {
        const themePath = await createConfiguredTheme(root)
        const storage = await createStorage(root)
        setThemeStore('remembered.myshopify.com', storage)
        const coordinator = createCoordinator(storage)
        let observedStore: string | undefined

        await coordinator.runSingle({
          flags: {path: themePath},
          requiresAuth: true,
          execute: async () => {
            observedStore = getThemeStore(storage)
          },
        })

        expect(observedStore).toBe(trustedStore)
        expect(getThemeStore(storage)).toBe('remembered.myshopify.com')
      })
    })

    test('provides the trusted store context when no store is remembered', async () => {
      await inTemporaryDirectory(async (root) => {
        const themePath = await createConfiguredTheme(root)
        const storage = await createStorage(root)
        const coordinator = createCoordinator(storage)
        let observedStore: string | undefined

        expect(getThemeStore(storage)).toBeUndefined()

        await coordinator.runSingle({
          flags: {path: themePath},
          requiresAuth: true,
          execute: async () => {
            observedStore = getThemeStore(storage)
          },
        })

        expect(observedStore).toBe(trustedStore)
        expect(getThemeStore(storage)).toBeUndefined()
      })
    })
  })

  describe('runBatch', () => {
    test('validates every target before projecting stored sessions', async () => {
      await inTemporaryDirectory(async (root) => {
        const firstPath = await createBatchTheme(root, 'first', 'first-store')
        const secondPath = await createBatchTheme(root, 'second', 'other-store')
        const storage = await createStorage(root)
        const storedSessionsFor = vi.fn(() => new Map<string, AdminSession>())
        const authenticate = vi.fn()
        const coordinator = createCoordinator(storage, {storedSessionsFor, authenticate})

        await expect(
          coordinator.runBatch({
            environments: [
              environment('first', firstPath, 'first-store.myshopify.com'),
              environment('second', secondPath, 'second-store.myshopify.com'),
            ],
            requiredFlags: ['store'],
            requiresAuth: true,
            execute: vi.fn(),
          }),
        ).rejects.toMatchObject({reason: 'invalid-batch'})

        expect(storedSessionsFor).not.toHaveBeenCalled()
        expect(authenticate).not.toHaveBeenCalled()
      })
    })

    test('lets a projected stored session satisfy the required password flag', async () => {
      await inTemporaryDirectory(async (root) => {
        const themePath = await createBatchTheme(root, 'preview', trustedStore)
        const storage = await createStorage(root)
        const storedSession: AdminSession = {token: 'stored-token', storeFqdn: trustedStore}
        const storedSessionsFor = vi.fn(() => new Map([[trustedStore, storedSession]]))
        const storedSessionFromCache = vi.fn((_flags: Record<string, unknown>, sessions: Map<string, AdminSession>) =>
          sessions.get(trustedStore),
        )
        const missingRequiredFlags = vi.fn(
          (flags: Record<string, unknown>, requiredFlags: (string | string[])[], suppliedSession?: AdminSession) =>
            requiredFlags
              .filter((requiredFlag) => {
                const alternatives = Array.isArray(requiredFlag) ? requiredFlag : [requiredFlag]
                return !alternatives.some((flag) => (flag === 'password' ? suppliedSession : flags[flag]))
              })
              .map((requiredFlag) => (Array.isArray(requiredFlag) ? requiredFlag.join(' or ') : requiredFlag)),
        )
        const authenticate = vi.fn(async (_flags, suppliedSession?: AdminSession) => suppliedSession ?? session)
        const execute = vi.fn()
        const coordinator = createCoordinator(storage, {
          authenticate,
          storedSessionsFor,
          storedSessionFromCache,
          missingRequiredFlags,
        })

        await coordinator.runBatch({
          environments: [environment('preview', themePath, trustedStore)],
          requiredFlags: ['store', 'password'],
          requiresAuth: true,
          execute,
        })

        expect(missingRequiredFlags).toHaveBeenCalledWith({store: trustedStore}, ['store', 'password'], storedSession)
        expect(authenticate).toHaveBeenCalledWith(expect.objectContaining({store: trustedStore}), storedSession)
        expect(execute.mock.calls[0]?.[0][0]?.session).toBe(storedSession)
      })
    })

    test('stops after validation when batch execution is not confirmed', async () => {
      await inTemporaryDirectory(async (root) => {
        const themePath = await createBatchTheme(root, 'preview', trustedStore)
        const storage = await createStorage(root)
        const events: string[] = []
        const storedSessionsFor = vi.fn(() => {
          events.push('project sessions')
          return new Map<string, AdminSession>()
        })
        const authenticate = vi.fn()
        const renderPreflight = vi.fn()
        const confirm = vi.fn(async () => {
          events.push('confirm')
          return false
        })
        const execute = vi.fn()
        const coordinator = createCoordinator(storage, {storedSessionsFor, authenticate, renderPreflight})

        await coordinator.runBatch({
          environments: [environment('preview', themePath, trustedStore)],
          requiredFlags: ['store'],
          requiresAuth: true,
          confirm,
          execute,
        })

        expect(events).toEqual(['project sessions', 'confirm'])
        expect(authenticate).not.toHaveBeenCalled()
        expect(renderPreflight).not.toHaveBeenCalled()
        expect(execute).not.toHaveBeenCalled()
      })
    })

    test('authenticates every environment before preflight', async () => {
      await inTemporaryDirectory(async (root) => {
        const firstPath = await createBatchTheme(root, 'first', 'first-store')
        const secondPath = await createBatchTheme(root, 'second', 'second-store')
        const storage = await createStorage(root)
        const events: string[] = []
        const authenticate = vi.fn(async (flags) => {
          events.push(`authenticate:${flags.store}`)
          return {token: String(flags.store), storeFqdn: flags.store as string}
        })
        const renderPreflight = vi.fn(() => events.push('preflight'))
        const coordinator = createCoordinator(storage, {authenticate, renderPreflight})

        await coordinator.runBatch({
          environments: [
            environment('first', firstPath, 'first-store.myshopify.com'),
            environment('second', secondPath, 'second-store.myshopify.com'),
          ],
          requiredFlags: ['store'],
          requiresAuth: true,
          execute: async () => {
            events.push('execute')
          },
        })

        expect(events).toEqual([
          'authenticate:first-store.myshopify.com',
          'authenticate:second-store.myshopify.com',
          'preflight',
          'execute',
        ])
      })
    })

    test('does not preflight or execute when authentication fails', async () => {
      await inTemporaryDirectory(async (root) => {
        const firstPath = await createBatchTheme(root, 'first', 'first-store')
        const secondPath = await createBatchTheme(root, 'second', 'second-store')
        const storage = await createStorage(root)
        const authenticate = vi
          .fn<CoordinatorOptions['authenticate']>()
          .mockResolvedValueOnce({token: 'first-token', storeFqdn: 'first-store.myshopify.com'})
          .mockRejectedValueOnce(new Error('authentication failed'))
        const renderPreflight = vi.fn()
        const execute = vi.fn()
        const coordinator = createCoordinator(storage, {authenticate, renderPreflight})

        await expect(
          coordinator.runBatch({
            environments: [
              environment('first', firstPath, 'first-store.myshopify.com'),
              environment('second', secondPath, 'second-store.myshopify.com'),
            ],
            requiredFlags: ['store'],
            requiresAuth: true,
            execute,
          }),
        ).rejects.toThrow('authentication failed')

        expect(authenticate).toHaveBeenCalledTimes(2)
        expect(renderPreflight).not.toHaveBeenCalled()
        expect(execute).not.toHaveBeenCalled()
      })
    })

    test('authenticates the same normalized store and password once', async () => {
      await inTemporaryDirectory(async (root) => {
        const firstPath = await createBatchTheme(root, 'first', 'shared-store')
        const secondPath = await createBatchTheme(root, 'second', 'SHARED-STORE.myshopify.com')
        const storage = await createStorage(root)
        const authenticatedSession: AdminSession = {token: 'shared-token', storeFqdn: 'shared-store.myshopify.com'}
        const authenticate = vi.fn().mockResolvedValue(authenticatedSession)
        const execute = vi.fn()
        const coordinator = createCoordinator(storage, {authenticate})

        await coordinator.runBatch({
          environments: [
            environment('first', firstPath, 'shared-store.myshopify.com', 'shared-password'),
            environment('second', secondPath, 'SHARED-STORE.myshopify.com', 'shared-password'),
          ],
          requiredFlags: ['store', 'password'],
          requiresAuth: true,
          execute,
        })

        expect(authenticate).toHaveBeenCalledOnce()
        expect(execute.mock.calls[0]?.[0][0]?.session).toBe(authenticatedSession)
        expect(execute.mock.calls[0]?.[0][1]?.session).toBe(authenticatedSession)
      })
    })

    test('authenticates distinct passwords for the same normalized store separately', async () => {
      await inTemporaryDirectory(async (root) => {
        const firstPath = await createBatchTheme(root, 'first', 'shared-store')
        const secondPath = await createBatchTheme(root, 'second', 'SHARED-STORE.myshopify.com')
        const storage = await createStorage(root)
        const authenticate = vi.fn(async (flags) => ({
          token: flags.password as string,
          storeFqdn: flags.store as string,
        }))
        const coordinator = createCoordinator(storage, {authenticate})

        await coordinator.runBatch({
          environments: [
            environment('first', firstPath, 'shared-store.myshopify.com', 'first-password'),
            environment('second', secondPath, 'SHARED-STORE.myshopify.com', 'second-password'),
          ],
          requiredFlags: ['store', 'password'],
          requiresAuth: true,
          execute: vi.fn(),
        })

        expect(authenticate).toHaveBeenCalledTimes(2)
        expect(authenticate).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({store: 'shared-store.myshopify.com', password: 'first-password'}),
          undefined,
        )
        expect(authenticate).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({store: 'shared-store.myshopify.com', password: 'second-password'}),
          undefined,
        )
      })
    })

    test('executes once with the complete authenticated batch', async () => {
      await inTemporaryDirectory(async (root) => {
        const firstPath = await createBatchTheme(root, 'first', 'first-store')
        const secondPath = await createBatchTheme(root, 'second', 'second-store')
        const storage = await createStorage(root)
        const execute = vi.fn()
        const coordinator = createCoordinator(storage)

        await coordinator.runBatch({
          environments: [
            environment('first', firstPath, 'first-store.myshopify.com'),
            environment('second', secondPath, 'second-store.myshopify.com'),
          ],
          requiredFlags: ['store'],
          requiresAuth: true,
          execute,
        })

        expect(execute).toHaveBeenCalledOnce()
        expect(execute.mock.calls[0]?.[0]).toEqual([
          expect.objectContaining({
            environment: 'first',
            flags: expect.objectContaining({store: 'first-store.myshopify.com'}),
            session: expect.objectContaining({storeFqdn: 'first-store.myshopify.com'}),
          }),
          expect.objectContaining({
            environment: 'second',
            flags: expect.objectContaining({store: 'second-store.myshopify.com'}),
            session: expect.objectContaining({storeFqdn: 'second-store.myshopify.com'}),
          }),
        ])
        expect(execute.mock.calls[0]?.[1]).toEqual([
          expect.objectContaining({environment: 'first', store: 'first-store.myshopify.com'}),
          expect.objectContaining({environment: 'second', store: 'second-store.myshopify.com'}),
        ])
      })
    })
  })
})
