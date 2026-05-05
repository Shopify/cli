import {applyRetryJitterMs, retryAwareRequest, isNetworkError, isTransientNetworkError} from './api.js'
import {recordRetry} from '../../public/node/analytics.js'
import {ClientError} from 'graphql-request'
import {describe, test, vi, expect, beforeEach, afterEach} from 'vitest'

vi.mock('../../public/node/analytics.js', () => ({
  recordRetry: vi.fn(),
}))

// Pins Math.random so jitter multiplies the base delay by exactly 1.0 (the midpoint of the ±20% band).
// Individual tests that need a different multiplier spy on Math.random directly.
const MIDPOINT_RANDOM_VALUE = 0.5

describe('retryAwareRequest', () => {
  let randomSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    randomSpy = vi.spyOn(Math, 'random').mockReturnValue(MIDPOINT_RANDOM_VALUE)
  })

  afterEach(() => {
    vi.useRealTimers()
    randomSpy.mockRestore()
  })

  test('handles retries', async () => {
    // First give a network error; then a rate limit with an explicit retry; then an unknown rate limit; then a successful call
    const rateLimitedResponseWithRetry = {
      status: 200,
      errors: [
        {
          extensions: {
            code: '429',
          },
        } as any,
      ],
      headers: new Headers({
        'retry-after': '200',
      }),
    }

    const rateLimitedResponse = {
      status: 200,
      errors: [
        {
          extensions: {
            code: '429',
          },
        } as any,
      ],
      headers: new Headers(),
    }

    const mockRequestFn = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('ENOTFOUND')
      })
      .mockImplementationOnce(() => {
        throw new ClientError(rateLimitedResponseWithRetry, {query: ''})
      })
      .mockImplementationOnce(() => {
        throw new ClientError(rateLimitedResponse, {query: ''})
      })
      .mockImplementationOnce(() => {
        return Promise.resolve({
          status: 200,
          data: {hello: 'world!'},
          headers: new Headers(),
        })
      })
    const mockScheduleDelayFn = vi.fn((fn, delay) => {
      return fn()
    })
    const result = retryAwareRequest(
      {
        request: mockRequestFn,
        url: 'https://example.com',
        useNetworkLevelRetry: true,
        maxRetryTimeMs: 10000,
      },
      undefined,
      {
        defaultDelayMs: 500,
        scheduleDelay: mockScheduleDelayFn,
      },
    )
    await vi.runAllTimersAsync()

    await expect(result).resolves.toEqual({
      headers: expect.anything(),
      status: 200,
      data: {hello: 'world!'},
    })

    expect(mockRequestFn).toHaveBeenCalledTimes(4)
    expect(mockScheduleDelayFn).toHaveBeenCalledTimes(2)
    // Retry-After: 200 seconds -> 200_000 ms; jitter pinned to midpoint (1.0x).
    expect(mockScheduleDelayFn).toHaveBeenNthCalledWith(1, expect.anything(), 200_000)
    // defaultDelayMs: 500 ms; jitter pinned to midpoint (1.0x).
    expect(mockScheduleDelayFn).toHaveBeenNthCalledWith(2, expect.anything(), 500)
  })

  test('fails after too many retries', async () => {
    // This test gives a false warning from vitest if fake timers are used. It thinks the exception is uncaught.
    vi.useRealTimers()
    const rateLimitedResponse = {
      status: 200,
      errors: [
        {
          extensions: {
            code: '429',
          },
        } as any,
      ],
      headers: new Headers(),
    }
    const mockRequestFn = vi.fn().mockImplementation(() => {
      throw new ClientError(rateLimitedResponse, {query: ''})
    })

    const mockScheduleDelayFn = vi.fn((fn, delay) => {
      return fn()
    })

    const result = retryAwareRequest(
      {
        request: mockRequestFn,
        url: 'https://example.com',
        useNetworkLevelRetry: true,
        maxRetryTimeMs: 10000,
      },
      undefined,
      {
        limitRetriesTo: 7,
        scheduleDelay: mockScheduleDelayFn,
      },
    )

    await expect(result).rejects.toThrowError(ClientError)

    expect(mockRequestFn).toHaveBeenCalledTimes(8)
    expect(mockScheduleDelayFn).toHaveBeenCalledTimes(7)
  })

  test('fails on network issue if retries are disabled', async () => {
    // This test gives a false warning from vitest if fake timers are used. It thinks the exception is uncaught.
    vi.useRealTimers()
    const mockRequestFnEnabled = vi
      .fn()
      .mockImplementationOnce(() => {
        // network issue
        throw new Error('ENOTFOUND')
      })
      .mockImplementationOnce(() => {
        // good response -- won't hit this with retries disabled
        return Promise.resolve({
          status: 200,
          data: {hello: 'world!'},
          headers: new Headers(),
        })
      })
    const mockRequestFnDisabled = vi
      .fn()
      .mockImplementationOnce(() => {
        // network issue
        throw new Error('ENOTFOUND')
      })
      .mockImplementationOnce(() => {
        // good response -- won't hit this with retries disabled
        return Promise.resolve({
          status: 200,
          data: {hello: 'world!'},
          headers: new Headers(),
        })
      })
    const mockScheduleDelayFn = vi.fn((fn, delay) => {
      return fn()
    })
    const networkRetryEnabled = retryAwareRequest(
      {
        request: mockRequestFnEnabled,
        url: 'https://example.com',
        useNetworkLevelRetry: true,
        maxRetryTimeMs: 10000,
      },
      undefined,
      {
        defaultDelayMs: 500,
        scheduleDelay: mockScheduleDelayFn,
      },
    )

    await expect(networkRetryEnabled).resolves.toEqual({
      headers: expect.anything(),
      status: 200,
      data: {hello: 'world!'},
    })

    const networkRetryDisabled = retryAwareRequest(
      {
        request: mockRequestFnDisabled,
        url: 'https://example.com',
        useNetworkLevelRetry: false,
      },
      undefined,
      {
        defaultDelayMs: 500,
        scheduleDelay: mockScheduleDelayFn,
      },
    )

    await expect(networkRetryDisabled).rejects.toThrowError('ENOTFOUND')
  })

  test('retries when request is aborted by client (AbortError message)', async () => {
    const mockRequestFn = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('the operation was aborted')
      })
      .mockImplementationOnce(() => {
        return Promise.resolve({
          status: 200,
          data: {ok: true},
          headers: new Headers(),
        })
      })

    const mockScheduleDelayFn = vi.fn((fn, _delay) => fn())

    const result = retryAwareRequest(
      {
        request: mockRequestFn,
        url: 'https://example.com/graphql.json',
        useNetworkLevelRetry: true,
        maxRetryTimeMs: 2000,
      },
      undefined,
      {
        defaultDelayMs: 10,
        scheduleDelay: mockScheduleDelayFn,
      },
    )

    await vi.runAllTimersAsync()

    await expect(result).resolves.toEqual({
      headers: expect.anything(),
      status: 200,
      data: {ok: true},
    })
    expect(mockRequestFn).toHaveBeenCalledTimes(2)
  })

  test('retries when fetch wrapper has blank reason in message', async () => {
    const blankReasonMessage = 'request to https://example.com/admin/api/unstable/graphql.json failed, reason:'

    const mockRequestFn = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error(blankReasonMessage)
      })
      .mockImplementationOnce(() => {
        return Promise.resolve({
          status: 200,
          data: {ok: true},
          headers: new Headers(),
        })
      })

    const mockScheduleDelayFn = vi.fn((fn, _delay) => fn())

    const result = retryAwareRequest(
      {
        request: mockRequestFn,
        url: 'https://example.com/graphql.json',
        useNetworkLevelRetry: true,
        maxRetryTimeMs: 2000,
      },
      undefined,
      {
        defaultDelayMs: 10,
        scheduleDelay: mockScheduleDelayFn,
      },
    )

    await vi.runAllTimersAsync()

    await expect(result).resolves.toEqual({
      headers: expect.anything(),
      status: 200,
      data: {ok: true},
    })
    expect(mockRequestFn).toHaveBeenCalledTimes(2)
  })

  test('retries when blank reason contains trailing whitespace/newlines', async () => {
    const blankReasonWithWhitespace =
      'request to https://example.com/admin/api/unstable/graphql.json failed, reason:   \n\t'

    const mockRequestFn = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error(blankReasonWithWhitespace)
      })
      .mockImplementationOnce(() => {
        return Promise.resolve({
          status: 200,
          data: {ok: true},
          headers: new Headers(),
        })
      })

    const result = retryAwareRequest(
      {
        request: mockRequestFn,
        url: 'https://example.com/graphql.json',
        useNetworkLevelRetry: true,
        maxRetryTimeMs: 2000,
      },
      undefined,
      {defaultDelayMs: 10, scheduleDelay: (fn) => fn()},
    )

    await vi.runAllTimersAsync()

    await expect(result).resolves.toEqual({
      headers: expect.anything(),
      status: 200,
      data: {ok: true},
    })
    expect(mockRequestFn).toHaveBeenCalledTimes(2)
  })

  test('does not treat non-blank reason as retryable when no known patterns match', async () => {
    vi.useRealTimers()
    const nonBlankUnknownReason =
      'request to https://example.com/admin/api/unstable/graphql.json failed, reason: gateway policy'

    const mockRequestFn = vi.fn().mockImplementationOnce(() => {
      throw new Error(nonBlankUnknownReason)
    })

    const result = retryAwareRequest(
      {
        request: mockRequestFn,
        url: 'https://example.com/graphql.json',
        useNetworkLevelRetry: true,
        maxRetryTimeMs: 2000,
      },
      undefined,
      {defaultDelayMs: 10, scheduleDelay: (fn) => fn()},
    )

    await expect(result).rejects.toThrowError(nonBlankUnknownReason)
    expect(mockRequestFn).toHaveBeenCalledTimes(1)
  })

  test('does not retry certificate/TLS/SSL errors (permanent network errors)', async () => {
    vi.useRealTimers()
    const certificateErrors = [
      'certificate has expired',
      "Hostname/IP does not match certificate's altnames",
      'TLS handshake failed',
      'SSL certificate problem: unable to get local issuer certificate',
    ]

    await Promise.all(
      certificateErrors.map(async (certError) => {
        const mockRequestFn = vi.fn().mockImplementation(() => {
          throw new Error(certError)
        })

        const result = retryAwareRequest(
          {
            request: mockRequestFn,
            url: 'https://example.com/graphql.json',
            useNetworkLevelRetry: true,
            maxRetryTimeMs: 2000,
          },
          undefined,
          {defaultDelayMs: 10, scheduleDelay: (fn) => fn()},
        )

        await expect(result).rejects.toThrowError(certError)
        expect(mockRequestFn).toHaveBeenCalledTimes(1)
      }),
    )
  })

  test('records retry events when recordRetries is enabled', async () => {
    const rateLimitedResponse = {
      status: 200,
      errors: [
        {
          extensions: {
            code: '429',
          },
        } as any,
      ],
      headers: new Headers({'retry-after': '100'}),
    }

    const successResponse = {
      status: 200,
      data: {hello: 'world!'},
      headers: new Headers(),
    }

    const mockRequestFn = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new ClientError(rateLimitedResponse, {query: ''})
      })
      .mockImplementation(() => {
        return Promise.resolve(successResponse)
      })

    const mockScheduleDelayFn = vi.fn((fn) => fn())

    const result = retryAwareRequest(
      {
        request: mockRequestFn,
        url: 'https://themes.example.com/api',
        useNetworkLevelRetry: true,
        maxRetryTimeMs: 10000,
        recordCommandRetries: true,
      },
      undefined,
      {
        scheduleDelay: mockScheduleDelayFn,
      },
    )
    await vi.runAllTimersAsync()

    await expect(result).resolves.toEqual({
      headers: expect.anything(),
      status: 200,
      data: {hello: 'world!'},
    })

    expect(recordRetry).toHaveBeenCalledTimes(1)
    expect(recordRetry).toHaveBeenCalledWith('https://themes.example.com/api', 'http-retry-1:can-retry:')
  })

  test('does not record retry events when recordRetries is disabled', async () => {
    const rateLimitedResponse = {
      status: 200,
      errors: [
        {
          extensions: {
            code: '429',
          },
        } as any,
      ],
      headers: new Headers(),
    }

    const successResponse = {
      status: 200,
      data: {hello: 'world!'},
      headers: new Headers(),
    }

    const mockRequestFn = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new ClientError(rateLimitedResponse, {query: ''})
      })
      .mockImplementation(() => {
        return Promise.resolve(successResponse)
      })

    const mockScheduleDelayFn = vi.fn((fn) => fn())

    const result = retryAwareRequest(
      {
        request: mockRequestFn,
        url: 'https://app.example.com/api',
        useNetworkLevelRetry: true,
        maxRetryTimeMs: 10000,
        recordCommandRetries: false,
      },
      undefined,
      {
        scheduleDelay: mockScheduleDelayFn,
      },
    )
    await vi.runAllTimersAsync()

    await expect(result).resolves.toEqual({
      headers: expect.anything(),
      status: 200,
      data: {hello: 'world!'},
    })

    expect(recordRetry).not.toHaveBeenCalled()
  })

  test('records multiple retry events with correct attempt numbers', async () => {
    const rateLimitedResponse = {
      status: 200,
      errors: [
        {
          extensions: {
            code: '429',
          },
        } as any,
      ],
      headers: new Headers(),
    }

    const successResponse = {
      status: 200,
      data: {success: true},
      headers: new Headers(),
    }

    const mockRequestFn = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new ClientError(rateLimitedResponse, {query: ''})
      })
      .mockImplementationOnce(() => {
        throw new ClientError(rateLimitedResponse, {query: ''})
      })
      .mockImplementation(() => {
        return Promise.resolve(successResponse)
      })

    const mockScheduleDelayFn = vi.fn((fn) => fn())

    const result = retryAwareRequest(
      {
        request: mockRequestFn,
        url: 'https://themes.example.com/upload',
        useNetworkLevelRetry: true,
        maxRetryTimeMs: 10000,
        recordCommandRetries: true,
      },
      undefined,
      {
        scheduleDelay: mockScheduleDelayFn,
      },
    )
    await vi.runAllTimersAsync()

    await expect(result).resolves.toEqual({
      headers: expect.anything(),
      status: 200,
      data: {success: true},
    })

    expect(recordRetry).toHaveBeenCalledTimes(2)
    expect(recordRetry).toHaveBeenNthCalledWith(1, 'https://themes.example.com/upload', 'http-retry-1:can-retry:')
    expect(recordRetry).toHaveBeenNthCalledWith(2, 'https://themes.example.com/upload', 'http-retry-2:can-retry:')
  })

  test('records retry events for too many requests status', async () => {
    const rateLimitedResponse = {
      status: 200,
      errors: [
        {
          extensions: {
            code: '429',
          },
        } as any,
      ],
      headers: new Headers(),
    }

    const successResponse = {
      status: 200,
      data: {authenticated: true},
      headers: new Headers(),
    }

    const mockRequestFn = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new ClientError(rateLimitedResponse, {query: ''})
      })
      .mockImplementation(() => {
        return Promise.resolve(successResponse)
      })

    const mockScheduleDelayFn = vi.fn((fn) => fn())

    const result = retryAwareRequest(
      {
        request: mockRequestFn,
        url: 'https://themes.example.com/auth',
        useNetworkLevelRetry: true,
        maxRetryTimeMs: 10000,
        recordCommandRetries: true,
      },
      undefined,
      {
        scheduleDelay: mockScheduleDelayFn,
      },
    )
    await vi.runAllTimersAsync()

    await expect(result).resolves.toEqual({
      headers: expect.anything(),
      status: 200,
      data: {authenticated: true},
    })

    expect(recordRetry).toHaveBeenCalledTimes(1)
    expect(recordRetry).toHaveBeenCalledWith('https://themes.example.com/auth', 'http-retry-1:can-retry:')
  })

  test('parses Retry-After header as seconds and converts to milliseconds', async () => {
    const rateLimitedResponse = {
      status: 200,
      errors: [
        {
          extensions: {
            code: '429',
          },
        } as any,
      ],
      headers: new Headers({'retry-after': '2'}),
    }

    const successResponse = {
      status: 200,
      data: {ok: true},
      headers: new Headers(),
    }

    const mockRequestFn = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new ClientError(rateLimitedResponse, {query: ''})
      })
      .mockImplementation(() => Promise.resolve(successResponse))

    const mockScheduleDelayFn = vi.fn((fn) => fn())

    const result = retryAwareRequest(
      {
        request: mockRequestFn,
        url: 'https://example.com',
        useNetworkLevelRetry: true,
        maxRetryTimeMs: 10_000,
      },
      undefined,
      {scheduleDelay: mockScheduleDelayFn},
    )
    await vi.runAllTimersAsync()
    await expect(result).resolves.toEqual(successResponse)

    // Retry-After: 2 -> 2000 ms (not 2 ms). Jitter pinned to midpoint (1.0x) via Math.random mock.
    expect(mockScheduleDelayFn).toHaveBeenCalledTimes(1)
    expect(mockScheduleDelayFn).toHaveBeenNthCalledWith(1, expect.anything(), 2000)
  })

  test('uses DEFAULT_RETRY_DELAY_MS when Retry-After header is absent and no caller default', async () => {
    const rateLimitedResponse = {
      status: 200,
      errors: [{extensions: {code: '429'}} as any],
      headers: new Headers(),
    }

    const successResponse = {
      status: 200,
      data: {ok: true},
      headers: new Headers(),
    }

    const mockRequestFn = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new ClientError(rateLimitedResponse, {query: ''})
      })
      .mockImplementation(() => Promise.resolve(successResponse))

    const mockScheduleDelayFn = vi.fn((fn) => fn())

    const result = retryAwareRequest(
      {
        request: mockRequestFn,
        url: 'https://example.com',
        useNetworkLevelRetry: true,
        maxRetryTimeMs: 10_000,
      },
      undefined,
      {scheduleDelay: mockScheduleDelayFn},
    )
    await vi.runAllTimersAsync()
    await expect(result).resolves.toEqual(successResponse)

    // No Retry-After, no defaultDelayMs -> falls back to DEFAULT_RETRY_DELAY_MS (1000).
    // Jitter pinned to midpoint (1.0x) via Math.random mock.
    expect(mockScheduleDelayFn).toHaveBeenCalledTimes(1)
    expect(mockScheduleDelayFn).toHaveBeenNthCalledWith(1, expect.anything(), 1000)
  })

  test('applies jitter multiplier from Math.random to retry delay', async () => {
    // Math.random() = 0.0 -> multiplier = 0.8 (lower bound).
    randomSpy.mockReturnValue(0)

    const rateLimitedResponse = {
      status: 200,
      errors: [{extensions: {code: '429'}} as any],
      headers: new Headers(),
    }

    const successResponse = {
      status: 200,
      data: {ok: true},
      headers: new Headers(),
    }

    const mockRequestFn = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new ClientError(rateLimitedResponse, {query: ''})
      })
      .mockImplementation(() => Promise.resolve(successResponse))

    const mockScheduleDelayFn = vi.fn((fn) => fn())

    const result = retryAwareRequest(
      {
        request: mockRequestFn,
        url: 'https://example.com',
        useNetworkLevelRetry: true,
        maxRetryTimeMs: 10_000,
      },
      undefined,
      {defaultDelayMs: 1000, scheduleDelay: mockScheduleDelayFn},
    )
    await vi.runAllTimersAsync()
    await expect(result).resolves.toEqual(successResponse)

    // 1000 * 0.8 = 800.
    expect(mockScheduleDelayFn).toHaveBeenNthCalledWith(1, expect.anything(), 800)
  })
})

describe('applyRetryJitterMs', () => {
  test('returns the lower bound (0.8x) when random() is 0', () => {
    expect(applyRetryJitterMs(1000, () => 0)).toBe(800)
  })

  test('returns the upper bound (~1.2x) when random() approaches 1', () => {
    // Math.random() returns [0, 1). Using 0.9999... exercises the top of the range.
    const nearOne = 1 - Number.EPSILON
    expect(applyRetryJitterMs(1000, () => nearOne)).toBeCloseTo(1200, 5)
  })

  test('returns the midpoint (1.0x) when random() is 0.5', () => {
    expect(applyRetryJitterMs(1000, () => 0.5)).toBe(1000)
  })

  test('keeps output within [0.8x, 1.2x] across the random range', () => {
    const baseDelayMs = 2500
    const samples = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 0.9999]
    for (const randomValue of samples) {
      const jittered = applyRetryJitterMs(baseDelayMs, () => randomValue)
      expect(jittered).toBeGreaterThanOrEqual(baseDelayMs * 0.8)
      expect(jittered).toBeLessThanOrEqual(baseDelayMs * 1.2)
    }
  })

  test('defaults to Math.random when no generator is passed', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
    try {
      expect(applyRetryJitterMs(1000)).toBe(1000)
      expect(spy).toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })
})

describe('isTransientNetworkError', () => {
  test('identifies transient network errors that should be retried', () => {
    const transientErrors = [
      'socket hang up',
      'ECONNRESET',
      'ECONNABORTED',
      'ENOTFOUND',
      'ENETUNREACH',
      'network socket disconnected',
      'ETIMEDOUT',
      'ECONNREFUSED',
      'EAI_AGAIN',
      'EPIPE',
      'the operation was aborted',
      'timeout occurred',
      'premature close',
      'getaddrinfo ENOTFOUND',
    ]

    for (const errorMsg of transientErrors) {
      expect(isTransientNetworkError(new Error(errorMsg))).toBe(true)
    }
  })

  test('identifies blank reason network errors', () => {
    const blankReasonErrors = [
      'request to https://example.com failed, reason:',
      'request to https://example.com failed, reason:   ',
      'request to https://example.com failed, reason:\n\t',
    ]

    for (const errorMsg of blankReasonErrors) {
      expect(isTransientNetworkError(new Error(errorMsg))).toBe(true)
    }
  })

  test('does not identify certificate errors as transient (should not be retried)', () => {
    const permanentErrors = [
      'certificate has expired',
      'cert verification failed',
      'TLS handshake failed',
      'SSL certificate problem',
      "Hostname/IP does not match certificate's altnames",
    ]

    for (const errorMsg of permanentErrors) {
      expect(isTransientNetworkError(new Error(errorMsg))).toBe(false)
    }
  })

  test('does not identify non-network errors as transient', () => {
    const nonNetworkErrors = [
      'Invalid JSON',
      'Syntax error',
      'undefined is not a function',
      'request failed with status 500',
    ]

    for (const errorMsg of nonNetworkErrors) {
      expect(isTransientNetworkError(new Error(errorMsg))).toBe(false)
    }
  })

  test('returns false for non-Error objects', () => {
    expect(isTransientNetworkError('string error')).toBe(false)
    expect(isTransientNetworkError(null)).toBe(false)
    expect(isTransientNetworkError(undefined)).toBe(false)
    expect(isTransientNetworkError({message: 'ENOTFOUND'})).toBe(false)
  })
})

describe('isNetworkError', () => {
  test('identifies all transient network errors', () => {
    const transientErrors = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'socket hang up', 'premature close']

    for (const errorMsg of transientErrors) {
      expect(isNetworkError(new Error(errorMsg))).toBe(true)
    }
  })

  test('identifies permanent network errors (certificate/TLS/SSL)', () => {
    const permanentErrors = [
      'certificate has expired',
      'cert verification failed',
      'TLS handshake failed',
      'SSL certificate problem',
      "Hostname/IP does not match certificate's altnames",
      'unable to verify the first certificate',
      'self signed certificate in certificate chain',
    ]

    for (const errorMsg of permanentErrors) {
      expect(isNetworkError(new Error(errorMsg))).toBe(true)
    }
  })

  test('does not identify non-network errors', () => {
    const nonNetworkErrors = [
      'Invalid JSON',
      'Syntax error',
      'undefined is not a function',
      'request failed with status 500',
    ]

    for (const errorMsg of nonNetworkErrors) {
      expect(isNetworkError(new Error(errorMsg))).toBe(false)
    }
  })

  test('returns false for non-Error objects', () => {
    expect(isNetworkError('string error')).toBe(false)
    expect(isNetworkError(null)).toBe(false)
    expect(isNetworkError(undefined)).toBe(false)
    expect(isNetworkError({message: 'certificate error'})).toBe(false)
  })
})
