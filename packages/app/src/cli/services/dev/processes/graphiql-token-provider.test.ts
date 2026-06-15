import {createClientCredentialsTokenProvider} from './graphiql-token-provider.js'
import {fetch} from '@shopify/cli-kit/node/http'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/http')

const mockedFetch = vi.mocked(fetch)

function mockTokenResponse(token: string) {
  mockedFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({access_token: token}),
  } as unknown as Awaited<ReturnType<typeof fetch>>)
}

function mockFailedTokenResponse(status: number, body: object = {}) {
  mockedFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => body,
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

  test('throws when the token response is not successful', async () => {
    mockFailedTokenResponse(401)

    const provider = createClientCredentialsTokenProvider({
      apiKey: 'api-key',
      apiSecret: 'api-secret',
      storeFqdn: 'store.myshopify.com',
    })

    await expect(provider.getToken()).rejects.toThrow('Token request failed with status 401')
    expect(mockedFetch).toHaveBeenCalledTimes(1)
  })

  test('throws when a successful token response does not include an access token', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as unknown as Awaited<ReturnType<typeof fetch>>)

    const provider = createClientCredentialsTokenProvider({
      apiKey: 'api-key',
      apiSecret: 'api-secret',
      storeFqdn: 'store.myshopify.com',
    })

    await expect(provider.getToken()).rejects.toThrow('Token request failed with status 200')
    expect(mockedFetch).toHaveBeenCalledTimes(1)
  })
})
