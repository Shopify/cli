import {createUnauthorizedHandler, DeveloperPlatformClient} from './developer-platform-client.js'
import {describe, expect, test, vi} from 'vitest'

describe('createUnauthorizedHandler', () => {
  const mockToken = 'mock-refreshed-token'
  const createMockClient = () => {
    let tokenRefreshInProgress = false
    return {
      getTokenRefreshInProgress: () => tokenRefreshInProgress,
      setTokenRefreshInProgress: (value: boolean) => {
        tokenRefreshInProgress = value
      },
      refreshToken: vi.fn().mockResolvedValue(mockToken),
    } as unknown as DeveloperPlatformClient
  }

  test('refreshes token on first attempt', async () => {
    const mockClient = createMockClient()
    const handler = createUnauthorizedHandler(mockClient)

    const result = await handler.handler()

    expect(result).toEqual({token: mockToken})
    expect(mockClient.refreshToken).toHaveBeenCalledTimes(1)
    expect(mockClient.getTokenRefreshInProgress()).toBe(false)
  })

  test('returns undefined on second attempt', async () => {
    const mockClient = createMockClient()
    const handler = createUnauthorizedHandler(mockClient)

    await handler.handler()
    const result = await handler.handler()

    expect(result).toEqual({token: undefined})
    expect(mockClient.refreshToken).toHaveBeenCalledTimes(1)
  })

  test('throws error when refresh is already in progress', async () => {
    const mockClient = createMockClient()
    mockClient.setTokenRefreshInProgress(true)

    await expect(createUnauthorizedHandler(mockClient).handler()).rejects.toThrow(
      'Multiple simultaneous token refresh attempts are not allowed',
    )
  })

  test('properly manages refresh in-progress flag', async () => {
    const mockClient = createMockClient()
    const handler = createUnauthorizedHandler(mockClient)

    await handler.handler()

    expect(mockClient.getTokenRefreshInProgress()).toBe(false)
  })

  test('handles token refresh failure and cleans up in-progress flag', async () => {
    const mockClient = createMockClient()
    const error = new Error('Token refresh failed')
    mockClient.refreshToken = vi.fn().mockRejectedValue(error)
    const handler = createUnauthorizedHandler(mockClient)

    await expect(handler.handler()).rejects.toThrow(error)
    expect(mockClient.getTokenRefreshInProgress()).toBe(false)
  })
})
