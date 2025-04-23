import {retryAwareRequest} from './api.js'
import {ClientError} from 'graphql-request'
import {describe, test, vi, expect, beforeEach, afterEach} from 'vitest'

describe('retryAwareRequest', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
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
    expect(mockScheduleDelayFn).toHaveBeenNthCalledWith(1, expect.anything(), 200)
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

  test('calls unauthorizedHandler when receiving 401', async () => {
    const unauthorizedResponse = {
      status: 401,
      errors: [
        {
          extensions: {
            code: '401',
          },
        } as any,
      ],
      headers: new Headers(),
    }

    const mockRequestFn = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new ClientError(unauthorizedResponse, {query: ''})
      })
      .mockImplementationOnce(() => {
        return Promise.resolve({
          status: 200,
          data: {hello: 'world!'},
          headers: new Headers(),
        })
      })

    const mockUnauthorizedHandler = vi.fn()
    const result = retryAwareRequest(
      {
        request: mockRequestFn,
        url: 'https://example.com',
        useNetworkLevelRetry: true,
        maxRetryTimeMs: 10000,
      },
      undefined,
      mockUnauthorizedHandler,
      {
        scheduleDelay: vi.fn((fn) => fn()),
      },
    )
    await vi.runAllTimersAsync()

    await expect(result).resolves.toEqual({
      headers: expect.anything(),
      status: 200,
      data: {hello: 'world!'},
    })

    expect(mockRequestFn).toHaveBeenCalledTimes(2)
    expect(mockUnauthorizedHandler).toHaveBeenCalledTimes(1)
  })

  test('throws original 401 when unauthorizedHandler returns {action: "throw"}', async () => {
    const unauthorizedError = new ClientError({status: 401}, {query: ''})

    const mockRequestFn = vi.fn().mockRejectedValueOnce(unauthorizedError)
    const mockUnauthorizedHandler = vi.fn().mockResolvedValue({action: 'throw'})

    const result = retryAwareRequest(
      {
        request: mockRequestFn,
        url: 'https://example.com',
        useNetworkLevelRetry: true,
        maxRetryTimeMs: 10000,
      },
      undefined,
      mockUnauthorizedHandler,
      {
        scheduleDelay: vi.fn((fn) => fn()),
      },
    )

    await vi.runAllTimersAsync()
    await expect(result).rejects.toThrow(unauthorizedError)
    expect(mockRequestFn).toHaveBeenCalledTimes(1)
    expect(mockUnauthorizedHandler).toHaveBeenCalledTimes(1)
    expect(mockUnauthorizedHandler).toHaveBeenCalledWith()
  })

  test('retries using standard logic when unauthorizedHandler returns {action: "continue"}', async () => {
    const unauthorizedError = new ClientError({status: 401}, {query: ''})

    const mockRequestFn = vi
      .fn()
      // First call: 401
      .mockRejectedValueOnce(unauthorizedError)
      // Second call: Success
      .mockResolvedValueOnce({status: 200, data: {success: true}, headers: new Headers()})

    const mockUnauthorizedHandler = vi.fn().mockResolvedValue({action: 'continue'})

    const result = retryAwareRequest(
      {
        request: mockRequestFn,
        url: 'https://example.com',
        // Network retry is irrelevant here as 401 is handled by handler
        useNetworkLevelRetry: true,
        maxRetryTimeMs: 10000,
      },
      undefined,
      mockUnauthorizedHandler,
      {
        scheduleDelay: vi.fn((fn) => fn()),
      },
    )

    await vi.runAllTimersAsync()
    await expect(result).resolves.toEqual({status: 200, data: {success: true}, headers: expect.any(Headers)})
    // Original + Retry after handler
    expect(mockRequestFn).toHaveBeenCalledTimes(2)
    expect(mockUnauthorizedHandler).toHaveBeenCalledTimes(1)
    expect(mockUnauthorizedHandler).toHaveBeenCalledWith()
  })

  test('retries using standard logic when unauthorizedHandler returns undefined (legacy)', async () => {
    const unauthorizedError = new ClientError({status: 401}, {query: ''})

    const mockRequestFn = vi
      .fn()
      // First call: 401
      .mockRejectedValueOnce(unauthorizedError)
      // Second call: Success
      .mockResolvedValueOnce({status: 200, data: {success: true}, headers: new Headers()})

    // Legacy return
    const mockUnauthorizedHandler = vi.fn().mockResolvedValue(undefined)

    const result = retryAwareRequest(
      {
        request: mockRequestFn,
        url: 'https://example.com',
        useNetworkLevelRetry: true,
        maxRetryTimeMs: 10000,
      },
      undefined,
      mockUnauthorizedHandler,
      {
        scheduleDelay: vi.fn((fn) => fn()),
      },
    )

    await vi.runAllTimersAsync()
    await expect(result).resolves.toEqual({status: 200, data: {success: true}, headers: expect.any(Headers)})
    // Original + Retry after handler
    expect(mockRequestFn).toHaveBeenCalledTimes(2)
    expect(mockUnauthorizedHandler).toHaveBeenCalledTimes(1)
    expect(mockUnauthorizedHandler).toHaveBeenCalledWith()
  })

  test('throws handler error if unauthorizedHandler rejects', async () => {
    const unauthorizedError = new ClientError({status: 401}, {query: ''})
    const handlerError = new Error('Handler failed spectacularly')

    const mockRequestFn = vi.fn().mockRejectedValueOnce(unauthorizedError)
    const mockUnauthorizedHandler = vi.fn().mockRejectedValue(handlerError)

    const result = retryAwareRequest(
      {
        request: mockRequestFn,
        url: 'https://example.com',
        useNetworkLevelRetry: true,
        maxRetryTimeMs: 10000,
      },
      undefined,
      mockUnauthorizedHandler,
      {
        scheduleDelay: vi.fn((fn) => fn()),
      },
    )

    await vi.runAllTimersAsync()
    await expect(result).rejects.toThrow(handlerError)
    expect(mockRequestFn).toHaveBeenCalledTimes(1)
    expect(mockUnauthorizedHandler).toHaveBeenCalledTimes(1)
    expect(mockUnauthorizedHandler).toHaveBeenCalledWith()
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
      undefined,
      {
        defaultDelayMs: 500,
        scheduleDelay: mockScheduleDelayFn,
      },
    )

    await expect(networkRetryDisabled).rejects.toThrowError('ENOTFOUND')
  })
})
