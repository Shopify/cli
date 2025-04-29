import {setupAppLogsPollingProcess, subscribeAndStartPolling} from './app-logs-polling.js'
import {
  testDeveloperPlatformClient,
  testAppWithConfig,
  testFunctionExtension,
} from '../../../models/app/app.test-data.js'
import {pollAppLogs} from '../../app-logs/dev/poll-app-logs.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import * as appLogsUtils from '../../app-logs/utils.js'
import {AppEventWatcher} from '../app-events/app-event-watcher.js'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {createLogsDir} from '@shopify/cli-kit/node/logs'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {describe, expect, vi, Mock, beforeEach, test} from 'vitest'

vi.mock('@shopify/cli-kit/node/logs')
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
      // Given
      const developerPlatformClient = testDeveloperPlatformClient()
      const session = await developerPlatformClient.session()
      const localApp = testAppWithConfig()
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

  describe('subscribeAndStartPolling', () => {
    const appLogsSubscribeVariables = {
      shopIds: SHOP_IDS,
      apiKey: API_KEY,
      token: TOKEN,
    }

    let subscribeToAppLogs: Mock
    let developerPlatformClient: DeveloperPlatformClient
    let stdout: any
    let stderr: any
    let abortSignal: AbortSignal
    let localApp: any
    let appWatcher: any

    beforeEach(async () => {
      stdout = {write: vi.fn()}
      stderr = {write: vi.fn()}
      abortSignal = new AbortSignal()
      subscribeToAppLogs = vi.fn()

      // Create function extension
      localApp = testAppWithConfig({
        config: {},
        app: {
          allExtensions: [await testFunctionExtension({config: DEFAULT_FUNCTION_CONFIG})],
        },
      })

      appWatcher = {
        onEvent: vi.fn().mockReturnThis(),
        onStart: vi.fn().mockReturnThis(),
      }

      developerPlatformClient = testDeveloperPlatformClient({subscribeToAppLogs})

      vi.mocked(createLogsDir).mockResolvedValue()
      vi.mocked(pollAppLogs).mockResolvedValue()
      vi.spyOn(appLogsUtils, 'subscribeToAppLogs').mockResolvedValue(JWT_TOKEN)
    })

    test('sets up app log polling', async () => {
      // Given
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

      expect(appWatcher.onStart).toHaveBeenCalledOnce()
      expect(appWatcher.onEvent).toHaveBeenCalledOnce()

      const startCallback = appWatcher.onStart.mock.calls[0][0]
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
      )
      expect(createLogsDir).toHaveBeenCalledWith(API_KEY)
      expect(pollAppLogs).toHaveBeenCalledOnce()
      expect(vi.mocked(pollAppLogs).mock.calls[0]?.[0]).toMatchObject({
        stdout,
        appLogsFetchInput: {jwtToken: JWT_TOKEN},
        apiKey: API_KEY,
      })

      const eventCallback = appWatcher.onEvent.mock.calls[0][0]
      expect(startCallback).toBe(eventCallback)
    })

    test('prints error and returns on query errors', async () => {
      // Given
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

      expect(appWatcher.onStart).toHaveBeenCalledOnce()
      expect(appWatcher.onEvent).toHaveBeenCalledOnce()

      const startCallback = appWatcher.onStart.mock.calls[0][0]
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
      )
      expect(outputDebug).toHaveBeenCalledWith('Failed to start function logs: Error: uh oh, another error', stderr)
      expect(pollAppLogs).not.toHaveBeenCalled()
    })
  })
})
