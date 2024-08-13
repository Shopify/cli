import {renderJsonLogs} from './render-json-logs.js'
import {pollAppLogs} from './poll-app-logs.js'
import {handleFetchAppLogsError} from '../utils.js'
import {testDeveloperPlatformClient} from '../../../models/app/app.test-data.js'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {describe, expect, vi, test, beforeEach, afterEach} from 'vitest'

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
    const mockSuccessResponse = {
      cursor: 'next-cursor',
      appLogs: [{payload: JSON.stringify({message: 'Log 1'})}, {payload: JSON.stringify({message: 'Log 2'})}],
    }
    const pollAppLogsMock = vi.fn().mockResolvedValue(mockSuccessResponse)
    vi.mocked(pollAppLogs).mockImplementation(pollAppLogsMock)

    await renderJsonLogs({
      pollOptions: {cursor: 'cursor', filters: {status: undefined, sources: undefined}, jwtToken: 'jwtToken'},
      options: {
        variables: {shopIds: ['1'], apiKey: 'key', token: 'token'},
        developerPlatformClient: testDeveloperPlatformClient(),
      },
    })

    expect(outputInfo).toHaveBeenNthCalledWith(1, JSON.stringify({payload: {message: 'Log 1'}}, null, 2))
    expect(outputInfo).toHaveBeenNthCalledWith(2, JSON.stringify({payload: {message: 'Log 2'}}, null, 2))
    expect(pollAppLogs).toHaveBeenCalled()
    expect(vi.getTimerCount()).toEqual(1)
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

    await renderJsonLogs({
      pollOptions: {cursor: 'cursor', filters: {status: undefined, sources: undefined}, jwtToken: 'jwtToken'},
      options: {
        variables: {shopIds: [], apiKey: '', token: ''},
        developerPlatformClient: testDeveloperPlatformClient(),
      },
    })

    expect(outputInfo).toHaveBeenCalledWith(
      JSON.stringify({message: 'Error while polling app logs.', retry_in_ms: mockRetryInterval}),
    )
    expect(pollAppLogs).toHaveBeenCalled()
    expect(vi.getTimerCount()).toEqual(1)
  })
})
