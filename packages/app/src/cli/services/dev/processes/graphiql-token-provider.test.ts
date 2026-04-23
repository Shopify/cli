import {createClientCredentialsTokenProvider} from './graphiql-token-provider.js'
import {fetch} from '@shopify/cli-kit/node/http'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/http')

const mockedFetch = vi.mocked(fetch)

function mockTokenResponse(token: string) {
  mockedFetch.mockResolvedValueOnce({
    json: async () => ({access_token: token}),
  } as unknown as Awaited<ReturnType<typeof fetch>>)
}

describe('createClientCredentialsTokenProvider', () => {
  beforeEach(() => {
    mockedFetch.mockReset()
  })

  test('mints a token on first getToken call and caches it', async () => {
    mockTokenResponse('first-token')

    const provider = createClientCredentialsTokenProvider({
      apiKey: 'api-key',
      apiSecret: 'api-secret',
      storeFqdn: 'store.myshopify.com',
    })

    await expect(provider.getToken()).resolves.toBe('first-token')
    await expect(provider.getToken()).resolves.toBe('first-token')
    expect(mockedFetch).toHaveBeenCalledTimes(1)
  })

  test('refreshToken always re-mints, even when a cached token exists', async () => {
    mockTokenResponse('first-token')
    mockTokenResponse('second-token')

    const provider = createClientCredentialsTokenProvider({
      apiKey: 'api-key',
      apiSecret: 'api-secret',
      storeFqdn: 'store.myshopify.com',
    })

    await expect(provider.getToken()).resolves.toBe('first-token')
    await expect(provider.refreshToken!()).resolves.toBe('second-token')
    await expect(provider.getToken()).resolves.toBe('second-token')
    expect(mockedFetch).toHaveBeenCalledTimes(2)
  })

  test('posts the OAuth client_credentials body to the store admin endpoint', async () => {
    mockTokenResponse('token')

    const provider = createClientCredentialsTokenProvider({
      apiKey: 'api-key',
      apiSecret: 'api-secret',
      storeFqdn: 'store.myshopify.com',
    })
    await provider.getToken()

    expect(mockedFetch).toHaveBeenCalledWith(
      'https://store.myshopify.com/admin/oauth/access_token',
      expect.objectContaining({
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          client_id: 'api-key',
          client_secret: 'api-secret',
          grant_type: 'client_credentials',
        }),
      }),
    )
  })
})
