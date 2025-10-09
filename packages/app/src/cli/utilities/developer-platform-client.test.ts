import {createUnauthorizedHandler, DeveloperPlatformClient} from './developer-platform-client.js'
import {describe, expect, test, vi} from 'vitest'

describe('createUnauthorizedHandler', () => {
  const mockAppManagementToken = 'mock-app-management-token'
  const mockBusinessPlatformToken = 'mock-business-platform-token'
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
      unsafeRefreshToken: vi.fn().mockResolvedValue(mockAppManagementToken),
      session: vi.fn().mockResolvedValue({
        token: mockAppManagementToken,
        businessPlatformToken: mockBusinessPlatformToken,
      }),
    } as unknown as DeveloperPlatformClient
  }

  test('refreshes token on first attempt and returns appManagement token by default', async () => {
    const mockClient = createMockClient()
    const handler = createUnauthorizedHandler(mockClient)

    const result = await handler.handler()

    expect(result).toEqual({token: mockAppManagementToken})
    expect(mockClient.unsafeRefreshToken).toHaveBeenCalledTimes(1)
  })

  test('reuses existing token refresh when one is in progress', async () => {
    const mockClient = createMockClient()
    const handler = createUnauthorizedHandler(mockClient)

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    handler.handler()
    const result = await handler.handler()

    expect(result).toEqual({token: mockAppManagementToken})
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

  test('returns businessPlatform token when tokenType is businessPlatform', async () => {
    const mockClient = createMockClient()
    const handler = createUnauthorizedHandler(mockClient, 'businessPlatform')

    const result = await handler.handler()

    expect(result).toEqual({token: mockBusinessPlatformToken})
    expect(mockClient.unsafeRefreshToken).toHaveBeenCalledTimes(1)
  })

  test('returns default token when tokenType is default', async () => {
    const mockClient = createMockClient()
    const handler = createUnauthorizedHandler(mockClient, 'default')

    const result = await handler.handler()

    expect(result).toEqual({token: mockAppManagementToken})
    expect(mockClient.unsafeRefreshToken).toHaveBeenCalledTimes(1)
  })
})
