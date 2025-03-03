import {renderJsonLogs} from './render-json-logs.js'
import {pollAppLogs} from './poll-app-logs.js'
import {handleFetchAppLogsError} from '../utils.js'
import {testDeveloperPlatformClient} from '../../../models/app/app.test-data.js'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {describe, expect, vi, test, beforeEach, afterEach} from 'vitest'
import {formatLocalDate} from '@shopify/cli-kit/common/string'

vi.mock('./poll-app-logs')
vi.mock('../utils', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../utils.js')>()
  return {
    ...mod,
    fetchAppLogs: vi.fn(),
    handleFetchAppLogsError: vi.fn(),
  }
})
vi.mock('@shopify/cli-kit/node/output')

describe('renderJsonLogs', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  test('should handle success response correctly', async () => {
    const utcTime = '2024-09-14T05:00:00.000Z'
    const localTime = formatLocalDate(utcTime)

    const mockSuccessResponse = {
      cursor: 'next-cursor',
      appLogs: [
        {shop_id: '1', payload: JSON.stringify({message: 'Log 1'}), log_timestamp: utcTime},
        {shop_id: '1', payload: JSON.stringify({message: 'Log 2'}), log_timestamp: utcTime},
      ],
    }
    const pollAppLogsMock = vi.fn().mockResolvedValue(mockSuccessResponse)
    vi.mocked(pollAppLogs).mockImplementation(pollAppLogsMock)

    const storeNameById = new Map<string, string>()
    storeNameById.set('1', 'storeName')
    await renderJsonLogs({
      pollOptions: {cursor: 'cursor', filters: {status: undefined, sources: undefined}, jwtToken: 'jwtToken'},
      options: {
        variables: {shopIds: ['1'], apiKey: 'key', token: 'token'},
        developerPlatformClient: testDeveloperPlatformClient(),
        organizationId: '1',
      },
      storeNameById,
    })

    expect(outputInfo).toHaveBeenNthCalledWith(
      1,
      JSON.stringify({
        shopId: '1',
        payload: {message: 'Log 1'},
        logTimestamp: utcTime,
        localTime,
        storeName: 'storeName',
      }),
    )
    expect(outputInfo).toHaveBeenNthCalledWith(
      2,
      JSON.stringify({
        shopId: '1',
        payload: {message: 'Log 2'},
        logTimestamp: utcTime,
        localTime,
        storeName: 'storeName',
      }),
    )
    expect(pollAppLogs).toHaveBeenCalled()
    expect(vi.getTimerCount()).toEqual(1)
  })

  test('should ignore logs with unknown store id', async () => {
    const utcTime = '2024-09-14T05:00:00.000Z'

    const mockSuccessResponse = {
      cursor: 'next-cursor',
      appLogs: [{shop_id: '80809', payload: JSON.stringify({message: 'Log 2'}), log_timestamp: utcTime}],
    }
    const pollAppLogsMock = vi.fn().mockResolvedValue(mockSuccessResponse)
    vi.mocked(pollAppLogs).mockImplementation(pollAppLogsMock)

    const storeNameById = new Map<string, string>()
    storeNameById.set('1', 'storeName')
    await renderJsonLogs({
      pollOptions: {cursor: 'cursor', filters: {status: undefined, sources: undefined}, jwtToken: 'jwtToken'},
      options: {
        variables: {shopIds: ['1'], apiKey: 'key', token: 'token'},
        developerPlatformClient: testDeveloperPlatformClient(),
        organizationId: '1',
      },
      storeNameById,
    })

    expect(outputInfo).not.toHaveBeenCalled()
  })

  test('should handle error response and retry as expected', async () => {
    const mockErrorResponse = {
      errors: [{status: 500, message: 'Server Error'}],
    }
    const pollAppLogsMock = vi.fn().mockResolvedValue(mockErrorResponse)
    vi.mocked(pollAppLogs).mockImplementation(pollAppLogsMock)
    const mockRetryInterval = 1000
    const handleFetchAppLogsErrorMock = vi.fn((input) => {
      input.onUnknownError(mockRetryInterval)
      return new Promise<{retryIntervalMs: number; nextJwtToken: string | null}>((resolve, _reject) => {
        resolve({nextJwtToken: 'new-jwt-token', retryIntervalMs: mockRetryInterval})
      })
    })
    vi.mocked(handleFetchAppLogsError).mockImplementation(handleFetchAppLogsErrorMock)

    const storeNameById = new Map<string, string>()
    storeNameById.set('1', 'storeName')
    await renderJsonLogs({
      pollOptions: {cursor: 'cursor', filters: {status: undefined, sources: undefined}, jwtToken: 'jwtToken'},
      options: {
        variables: {shopIds: [], apiKey: '', token: ''},
        developerPlatformClient: testDeveloperPlatformClient(),
        organizationId: '1',
      },
      storeNameById,
    })

    expect(outputInfo).toHaveBeenCalledWith(
      JSON.stringify({message: 'Error while polling app logs.', retry_in_ms: mockRetryInterval}),
    )
    expect(pollAppLogs).toHaveBeenCalled()
    expect(vi.getTimerCount()).toEqual(1)
  })
})
