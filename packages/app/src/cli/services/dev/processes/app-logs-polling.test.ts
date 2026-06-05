import {setupAppLogsPollingProcess, subscribeAndStartPolling} from './app-logs-polling.js'
import {
  testDeveloperPlatformClient,
  testAppWithConfig,
  testFunctionExtension,
} from '../../../models/app/app.test-data.js'
import {pollAppLogs} from '../../app-logs/dev/poll-app-logs.js'
import * as appLogsUtils from '../../app-logs/utils.js'
import {AppEventWatcher} from '../app-events/app-event-watcher.js'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {inTemporaryDirectory, fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {describe, expect, vi, test} from 'vitest'
import {Writable} from 'stream'

vi.mock('@shopify/cli-kit/node/output')
vi.mock('../../app-logs/dev/poll-app-logs.js')

const SHOP_IDS = [1, 2]
const API_KEY = 'API_KEY'
const TOKEN = 'token'
const JWT_TOKEN = 'JWT'
const DEFAULT_FUNCTION_CONFIG = {
  name: 'test-function',
  type: 'function',
  api_version: '2023-01',
  configuration_ui: true,
  build: {wasm_opt: true},
}

describe('app-logs-polling', () => {
  describe('setupAppLogsPollingProcess', () => {
    test('returns process metadata', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const developerPlatformClient = testDeveloperPlatformClient()
        const session = await developerPlatformClient.session()
        const localApp = testAppWithConfig({
          app: {
            directory: tmpDir,
            configPath: joinPath(tmpDir, 'shopify.app.toml'),
          },
          config: {},
        })
        const appWatcher = new AppEventWatcher(localApp)

        // When
        const result = await setupAppLogsPollingProcess({
          developerPlatformClient,
          subscription: {shopIds: SHOP_IDS, apiKey: API_KEY},
          storeName: 'storeName',
          organizationId: 'organizationId',
          localApp,
          appWatcher,
        })

        // Then
        expect(result).toMatchObject({
          type: 'app-logs-subscribe',
          prefix: 'app-logs',
          function: subscribeAndStartPolling,
          options: {
            developerPlatformClient,
            appLogsSubscribeVariables: {
              shopIds: SHOP_IDS,
              apiKey: API_KEY,
            },
            localApp,
            appWatcher,
          },
        })
      })
    })
  })

  describe('subscribeAndStartPolling', () => {
    const appLogsSubscribeVariables = {
      shopIds: SHOP_IDS,
      apiKey: API_KEY,
      token: TOKEN,
    }

    test('sets up app log polling', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const stdout = {write: vi.fn()} as unknown as Writable
        const stderr = {write: vi.fn()} as unknown as Writable
        const abortSignal = new AbortSignal()
        const subscribeToAppLogs = vi.fn()

        const localApp = testAppWithConfig({
          app: {
            directory: tmpDir,
            configPath: joinPath(tmpDir, 'shopify.app.toml'),
            allExtensions: [await testFunctionExtension({dir: joinPath(tmpDir, 'extensions', 'my-function')})],
          },
          config: {},
        })

        const onEvent = vi.fn().mockReturnThis()
        const onStart = vi.fn().mockReturnThis()
        const appWatcher = {
          onEvent,
          onStart,
        } as unknown as AppEventWatcher

        const developerPlatformClient = testDeveloperPlatformClient({subscribeToAppLogs})

        vi.mocked(pollAppLogs).mockResolvedValue()
        vi.spyOn(appLogsUtils, 'subscribeToAppLogs').mockResolvedValue(JWT_TOKEN)

        subscribeToAppLogs.mockResolvedValue({appLogsSubscribe: {jwtToken: JWT_TOKEN, success: true}})

        // When
        await subscribeAndStartPolling(
          {stdout, stderr, abortSignal},
          {
            developerPlatformClient,
            appLogsSubscribeVariables,
            storeName: 'storeName',
            organizationId: 'organizationId',
            localApp,
            appWatcher,
          },
        )

        expect(onStart).toHaveBeenCalledOnce()
        expect(onEvent).toHaveBeenCalledOnce()

        const startCallback = onStart.mock.calls[0]![0]
        const appEvent = {
          app: localApp,
          extensionEvents: [],
          startTime: [0, 0],
          path: '',
        }
        await startCallback(appEvent)

        // Then
        expect(outputDebug).toHaveBeenCalledWith('Function extensions detected, starting logs polling')
        expect(appLogsUtils.subscribeToAppLogs).toHaveBeenCalledWith(
          developerPlatformClient,
          appLogsSubscribeVariables,
          'organizationId',
          stdout,
        )
        await expect(fileExists(localApp.getLogsDir())).resolves.toBe(true)
        expect(pollAppLogs).toHaveBeenCalledOnce()
        expect(vi.mocked(pollAppLogs).mock.calls[0]![0]).toMatchObject({
          stdout,
          appLogsFetchInput: {jwtToken: JWT_TOKEN},
          logsDir: localApp.getLogsDir(),
        })

        const eventCallback = onEvent.mock.calls[0]![0]
        expect(startCallback).toBe(eventCallback)
      })
    })

    test('prints error and returns on query errors', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const stdout = {write: vi.fn()} as unknown as Writable
        const stderr = {write: vi.fn()} as unknown as Writable
        const abortSignal = new AbortSignal()
        const subscribeToAppLogs = vi.fn()

        const localApp = testAppWithConfig({
          app: {
            directory: tmpDir,
            configPath: joinPath(tmpDir, 'shopify.app.toml'),
            allExtensions: [await testFunctionExtension({dir: joinPath(tmpDir, 'extensions', 'my-function')})],
          },
          config: {},
        })

        const onEvent = vi.fn().mockReturnThis()
        const onStart = vi.fn().mockReturnThis()
        const appWatcher = {
          onEvent,
          onStart,
        } as unknown as AppEventWatcher

        const developerPlatformClient = testDeveloperPlatformClient({subscribeToAppLogs})

        vi.mocked(pollAppLogs).mockResolvedValue()
        vi.spyOn(appLogsUtils, 'subscribeToAppLogs').mockImplementation(() => {
          throw new Error('uh oh, another error')
        })

        // When
        await subscribeAndStartPolling(
          {stdout, stderr, abortSignal},
          {
            developerPlatformClient,
            appLogsSubscribeVariables,
            storeName: 'storeName',
            organizationId: 'organizationId',
            localApp,
            appWatcher,
          },
        )

        expect(onStart).toHaveBeenCalledOnce()
        expect(onEvent).toHaveBeenCalledOnce()

        const startCallback = onStart.mock.calls[0]![0]
        const appEvent = {
          app: localApp,
          extensionEvents: [],
          startTime: [0, 0],
          path: '',
        }
        await startCallback(appEvent)

        // Then
        expect(appLogsUtils.subscribeToAppLogs).toHaveBeenCalledWith(
          developerPlatformClient,
          appLogsSubscribeVariables,
          'organizationId',
          stdout,
        )
        expect(outputDebug).toHaveBeenCalledWith('Failed to start function logs: Error: uh oh, another error', stderr)
        expect(pollAppLogs).not.toHaveBeenCalled()
      })
    })
  })
})
