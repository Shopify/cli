import {createUnauthorizedHandler, DeveloperPlatformClient} from './developer-platform-client.js'
import {describe, expect, test, vi} from 'vitest'

describe('createUnauthorizedHandler', () => {
  const mockToken = 'mock-refreshed-token'
  const createMockClient = () => {
    let tokenRefreshPromise: Promise<string> | undefined
    return {
      getCurrentlyRefreshingToken: () => tokenRefreshPromise,
      setCurrentlyRefreshingToken: (promise: Promise<string>) => {
        tokenRefreshPromise = promise
      },
      clearCurrentlyRefreshingToken: () => {
        tokenRefreshPromise = undefined
      },
      unsafeRefreshToken: vi.fn().mockResolvedValue(mockToken),
    } as unknown as DeveloperPlatformClient
  }

  test('refreshes token on first attempt', async () => {
    const mockClient = createMockClient()
    const handler = createUnauthorizedHandler(mockClient)

    const result = await handler.handler()

    expect(result).toEqual({token: mockToken})
    expect(mockClient.unsafeRefreshToken).toHaveBeenCalledTimes(1)
  })

  test('reuses existing token refresh when one is in progress', async () => {
    const mockClient = createMockClient()
    const handler = createUnauthorizedHandler(mockClient)

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    handler.handler()
    const result = await handler.handler()

    expect(result).toEqual({token: mockToken})
    expect(mockClient.unsafeRefreshToken).toHaveBeenCalledTimes(1)
  })

  test('handles token refresh failure and cleans up in-progress promise', async () => {
    const mockClient = createMockClient()
    const error = new Error('Token refresh failed')
    mockClient.unsafeRefreshToken = vi.fn().mockRejectedValue(error)
    const handler = createUnauthorizedHandler(mockClient)

    await expect(handler.handler()).rejects.toThrow(error)
    await expect(handler.handler()).rejects.toThrow(error)

    // The following is evidence that the finally block is called correctly
    expect(mockClient.unsafeRefreshToken).toHaveBeenCalledTimes(2)
  })
})
