import {retryAwareRequest} from './api.js'
import {ClientError} from 'graphql-request'
import {describe, test, vi, expect} from 'vitest'

describe('retryAwareRequest', () => {
  test('handles retries', async () => {
    // First give a rate limit with an explicit retry; then an unknown rate limit; then a successful call
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
    const result = await retryAwareRequest(
      {
        request: mockRequestFn,
        url: 'https://example.com',
      },
      undefined,
      undefined,
      {
        defaultDelayMs: 500,
        scheduleDelay: mockScheduleDelayFn,
      },
    )

    expect(result).toEqual({
      headers: expect.anything(),
      status: 200,
      data: {hello: 'world!'},
    })

    expect(mockRequestFn).toHaveBeenCalledTimes(3)
    expect(mockScheduleDelayFn).toHaveBeenCalledTimes(2)
    expect(mockScheduleDelayFn).toHaveBeenNthCalledWith(1, expect.anything(), 200)
    expect(mockScheduleDelayFn).toHaveBeenNthCalledWith(2, expect.anything(), 500)
  })

  test('fails after too many retries', async () => {
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

    await expect(
      retryAwareRequest(
        {
          request: mockRequestFn,
          url: 'https://example.com',
        },
        undefined,
        undefined,
        {
          limitRetriesTo: 7,
          scheduleDelay: mockScheduleDelayFn,
        },
      ),
    ).rejects.toThrowError(ClientError)

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

    await expect(
      retryAwareRequest(
        {
          request: mockRequestFn,
          url: 'https://example.com',
        },
        undefined,
        mockUnauthorizedHandler,
        {
          scheduleDelay: vi.fn((fn) => fn()),
        },
      ),
    ).resolves.toEqual({
      headers: expect.anything(),
      status: 200,
      data: {hello: 'world!'},
    })

    expect(mockRequestFn).toHaveBeenCalledTimes(2)
    expect(mockUnauthorizedHandler).toHaveBeenCalledTimes(1)
  })
})
