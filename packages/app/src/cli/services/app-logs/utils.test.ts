import {
  handleFetchAppLogsError,
  POLLING_ERROR_RETRY_INTERVAL_MS,
  POLLING_INTERVAL_MS,
  POLLING_THROTTLE_RETRY_INTERVAL_MS,
} from './utils.js'
import {describe, expect, test, vi} from 'vitest'

describe('handleFetchAppLogsError', () => {
  test('keeps the regular polling interval and attempts nothing when there are no errors', async () => {
    // Given
    const onResubscribe = vi.fn()

    // When
    const result = await handleFetchAppLogsError({
      response: {errors: []},
      onThrottle: vi.fn(),
      onUnknownError: vi.fn(),
      onResubscribe,
    })

    // Then
    expect(result).toEqual({
      retryIntervalMs: POLLING_INTERVAL_MS,
      nextJwtToken: null,
      resubscribeResult: 'not_attempted',
    })
    expect(onResubscribe).not.toHaveBeenCalled()
  })

  test('resubscribes and returns the refreshed token on a 401', async () => {
    // Given
    const onThrottle = vi.fn()

    // When
    const result = await handleFetchAppLogsError({
      response: {errors: [{status: 401, message: 'Unauthorized'}]},
      onThrottle,
      onUnknownError: vi.fn(),
      onResubscribe: async () => 'refreshed-token',
    })

    // Then
    expect(result).toEqual({
      retryIntervalMs: POLLING_INTERVAL_MS,
      nextJwtToken: 'refreshed-token',
      resubscribeResult: 'succeeded',
    })
    expect(onThrottle).not.toHaveBeenCalled()
  })

  test('throttles instead of retrying immediately when resubscribing after a 401 fails', async () => {
    // Given
    const onThrottle = vi.fn()

    // When
    const result = await handleFetchAppLogsError({
      response: {errors: [{status: 401, message: 'Unauthorized'}]},
      onThrottle,
      onUnknownError: vi.fn(),
      onResubscribe: async () => Promise.reject(new Error('Resubscribe failed')),
    })

    // Then
    expect(result).toEqual({
      retryIntervalMs: POLLING_THROTTLE_RETRY_INTERVAL_MS,
      nextJwtToken: null,
      resubscribeResult: 'failed',
    })
    expect(onThrottle).toHaveBeenCalledWith(POLLING_THROTTLE_RETRY_INTERVAL_MS)
  })

  test('throttles without resubscribing on a 429', async () => {
    // Given
    const onThrottle = vi.fn()
    const onResubscribe = vi.fn()

    // When
    const result = await handleFetchAppLogsError({
      response: {errors: [{status: 429, message: 'Too many requests'}]},
      onThrottle,
      onUnknownError: vi.fn(),
      onResubscribe,
    })

    // Then
    expect(result).toEqual({
      retryIntervalMs: POLLING_THROTTLE_RETRY_INTERVAL_MS,
      nextJwtToken: null,
      resubscribeResult: 'not_attempted',
    })
    expect(onThrottle).toHaveBeenCalledWith(POLLING_THROTTLE_RETRY_INTERVAL_MS)
    expect(onResubscribe).not.toHaveBeenCalled()
  })

  test('reports an unknown error for any other status', async () => {
    // Given
    const onUnknownError = vi.fn()

    // When
    const result = await handleFetchAppLogsError({
      response: {errors: [{status: 500, message: 'Internal server error'}]},
      onThrottle: vi.fn(),
      onUnknownError,
      onResubscribe: vi.fn(),
    })

    // Then
    expect(result).toEqual({
      retryIntervalMs: POLLING_ERROR_RETRY_INTERVAL_MS,
      nextJwtToken: null,
      resubscribeResult: 'not_attempted',
    })
    expect(onUnknownError).toHaveBeenCalledWith(POLLING_ERROR_RETRY_INTERVAL_MS)
  })

  test('prioritises resubscribing when a 401 accompanies other errors', async () => {
    // Given
    const onUnknownError = vi.fn()
    const onThrottle = vi.fn()

    // When
    const result = await handleFetchAppLogsError({
      response: {
        errors: [
          {status: 500, message: 'Internal server error'},
          {status: 401, message: 'Unauthorized'},
        ],
      },
      onThrottle,
      onUnknownError,
      onResubscribe: async () => 'refreshed-token',
    })

    // Then
    expect(result.nextJwtToken).toBe('refreshed-token')
    expect(result.resubscribeResult).toBe('succeeded')
    expect(onUnknownError).not.toHaveBeenCalled()
    expect(onThrottle).not.toHaveBeenCalled()
  })
})
