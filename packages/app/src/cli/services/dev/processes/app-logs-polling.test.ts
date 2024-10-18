import {setupAppLogsPollingProcess, subscribeAndStartPolling} from './app-logs-polling.js'
import {testDeveloperPlatformClient} from '../../../models/app/app.test-data.js'
import {pollAppLogs} from '../../app-logs/dev/poll-app-logs.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {createLogsDir} from '@shopify/cli-kit/node/logs'
import {describe, expect, vi, Mock, beforeEach, test} from 'vitest'
import {outputWarn} from '@shopify/cli-kit/node/output'

vi.mock('@shopify/cli-kit/node/logs')
vi.mock('@shopify/cli-kit/node/output')
vi.mock('../../app-logs/dev/poll-app-logs.js')

const SHOP_IDS = ['1', '2']
const API_KEY = 'API_KEY'
const TOKEN = 'token'
const JWT_TOKEN = 'JWT'

describe('app-logs-polling', () => {
  describe('setupAppLogsPollingProcess', () => {
    test('returns process metadata', async () => {
      // Given
      const developerPlatformClient = testDeveloperPlatformClient()
      const session = await developerPlatformClient.session()

      // When
      const result = await setupAppLogsPollingProcess({
        developerPlatformClient,
        subscription: {shopIds: SHOP_IDS, apiKey: API_KEY},
        storeName: 'storeName',
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
            token: session.token,
          },
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

    beforeEach(() => {
      stdout = {write: vi.fn()}
      stderr = {write: vi.fn()}
      abortSignal = new AbortSignal()
      subscribeToAppLogs = vi.fn()
      developerPlatformClient = testDeveloperPlatformClient({subscribeToAppLogs})

      vi.mocked(createLogsDir).mockResolvedValue()
      vi.mocked(pollAppLogs).mockResolvedValue()
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
        },
      )

      // Then
      expect(subscribeToAppLogs).toHaveBeenCalledWith(appLogsSubscribeVariables)
      expect(createLogsDir).toHaveBeenCalledWith(API_KEY)
      expect(pollAppLogs).toHaveBeenCalledOnce()
      expect(vi.mocked(pollAppLogs).mock.calls[0]?.[0]).toMatchObject({
        stdout,
        appLogsFetchInput: {jwtToken: JWT_TOKEN},
        apiKey: API_KEY,
      })
    })

    test('prints error and returns on query errors', async () => {
      // Given
      subscribeToAppLogs.mockResolvedValue({
        appLogsSubscribe: {success: false, errors: ['uh oh', 'another error'], jwtToken: null},
      })

      // When
      await subscribeAndStartPolling(
        {stdout, stderr, abortSignal},
        {
          developerPlatformClient,
          appLogsSubscribeVariables,
          storeName: 'storeName',
        },
      )

      // Then
      expect(subscribeToAppLogs).toHaveBeenCalledWith(appLogsSubscribeVariables)
      expect(outputWarn).toHaveBeenCalledWith(`Errors subscribing to app logs: uh oh, another error`)
      expect(outputWarn).toHaveBeenCalledWith(`App log streaming is not available in this session.`)
      expect(createLogsDir).not.toHaveBeenCalled()
      expect(pollAppLogs).not.toHaveBeenCalled()
    })
  })
})
