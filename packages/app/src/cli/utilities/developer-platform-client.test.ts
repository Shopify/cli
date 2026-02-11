import {createUnauthorizedHandler, DeveloperPlatformClient} from './developer-platform-client.js'
import {getToken} from '@shopify/cli-kit/node/session'
import {describe, expect, test, vi, beforeEach} from 'vitest'

vi.mock('@shopify/cli-kit/node/session', async (importOriginal) => {
  const original = await importOriginal<typeof import('@shopify/cli-kit/node/session')>()
  return {...original, getToken: vi.fn()}
})

describe('createUnauthorizedHandler', () => {
  const mockAppManagementToken = 'mock-app-management-token'
  const mockBusinessPlatformToken = 'mock-business-platform-token'
  const createMockClient = () => {
    return {
      unsafeRefreshToken: vi.fn().mockResolvedValue(mockAppManagementToken),
    } as unknown as DeveloperPlatformClient
  }

  beforeEach(() => {
    vi.mocked(getToken).mockImplementation(async (audience) => {
      if (audience === 'business-platform') return mockBusinessPlatformToken
      return mockAppManagementToken
    })
  })

  test('refreshes token on first attempt and returns token for the given audience', async () => {
    const mockClient = createMockClient()
    const handler = createUnauthorizedHandler(mockClient, 'app-management')

    const result = await handler.handler()

    expect(result).toEqual({token: mockAppManagementToken})
    expect(mockClient.unsafeRefreshToken).toHaveBeenCalledTimes(1)
  })

  test('reuses existing token refresh when one is in progress', async () => {
    const mockClient = createMockClient()
    const handler = createUnauthorizedHandler(mockClient, 'app-management')

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
    const handler = createUnauthorizedHandler(mockClient, 'app-management')

    await expect(handler.handler()).rejects.toThrow(error)
    await expect(handler.handler()).rejects.toThrow(error)

    // The following is evidence that the finally block is called correctly
    expect(mockClient.unsafeRefreshToken).toHaveBeenCalledTimes(2)
  })

  test('returns business-platform token when audience is business-platform', async () => {
    const mockClient = createMockClient()
    const handler = createUnauthorizedHandler(mockClient, 'business-platform')

    const result = await handler.handler()

    expect(result).toEqual({token: mockBusinessPlatformToken})
    expect(mockClient.unsafeRefreshToken).toHaveBeenCalledTimes(1)
  })

  test('returns app-management token when audience is app-management', async () => {
    const mockClient = createMockClient()
    const handler = createUnauthorizedHandler(mockClient, 'app-management')

    const result = await handler.handler()

    expect(result).toEqual({token: mockAppManagementToken})
    expect(mockClient.unsafeRefreshToken).toHaveBeenCalledTimes(1)
  })
})
