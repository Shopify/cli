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
})
