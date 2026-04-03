import {beforeEach, describe, expect, test, vi} from 'vitest'
import {adminUrl} from '@shopify/cli-kit/node/api/admin'
import {graphqlRequest} from '@shopify/cli-kit/node/api/graphql'
import {fetch} from '@shopify/cli-kit/node/http'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {
  exchangeStoreAuthCodeForToken,
  fetchCurrentStoreAuthScopes,
  refreshStoreAccessToken,
} from './token-client.js'
import {STORE_AUTH_APP_CLIENT_ID} from './config.js'

vi.mock('@shopify/cli-kit/node/http')
vi.mock('@shopify/cli-kit/node/api/graphql')
vi.mock('@shopify/cli-kit/node/api/admin', async () => {
  const actual = await vi.importActual<typeof import('@shopify/cli-kit/node/api/admin')>('@shopify/cli-kit/node/api/admin')
  return {
    ...actual,
    adminUrl: vi.fn(),
  }
})
vi.mock('@shopify/cli-kit/node/output', async () => {
  const actual = await vi.importActual<typeof import('@shopify/cli-kit/node/output')>('@shopify/cli-kit/node/output')
  return {
    ...actual,
    outputDebug: vi.fn(),
  }
})

describe('token client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(adminUrl).mockReturnValue('https://shop.myshopify.com/admin/api/unstable/graphql.json')
  })

  test('exchangeStoreAuthCodeForToken sends PKCE params and returns token response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          access_token: 'token',
          scope: 'read_products',
          expires_in: 86400,
          refresh_token: 'refresh-token',
          associated_user: {id: 42, email: 'test@example.com'},
        }),
      ),
    } as any)

    const response = await exchangeStoreAuthCodeForToken({
      store: 'shop.myshopify.com',
      code: 'abc123',
      codeVerifier: 'test-verifier',
      redirectUri: 'http://127.0.0.1:13387/auth/callback',
    })

    expect(response.access_token).toBe('token')
    expect(response.refresh_token).toBe('refresh-token')
    expect(fetch).toHaveBeenCalledWith(
      'https://shop.myshopify.com/admin/oauth/access_token',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"code_verifier":"test-verifier"'),
      }),
    )

    const sentBody = JSON.parse((fetch as any).mock.calls[0][1].body)
    expect(sentBody.client_id).toBe(STORE_AUTH_APP_CLIENT_ID)
    expect(sentBody.code).toBe('abc123')
    expect(sentBody.code_verifier).toBe('test-verifier')
    expect(sentBody.redirect_uri).toBe('http://127.0.0.1:13387/auth/callback')
  })

  test('refreshStoreAccessToken sends refresh params and returns normalized payload', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          access_token: 'fresh-token',
          refresh_token: 'fresh-refresh-token',
          expires_in: 3600,
          refresh_token_expires_in: 7200,
        }),
      ),
    } as any)

    await expect(
      refreshStoreAccessToken({store: 'shop.myshopify.com', refreshToken: 'refresh-token'}),
    ).resolves.toEqual({
      accessToken: 'fresh-token',
      refreshToken: 'fresh-refresh-token',
      expiresIn: 3600,
      refreshTokenExpiresIn: 7200,
    })

    expect(fetch).toHaveBeenCalledWith(
      'https://shop.myshopify.com/admin/oauth/access_token',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          client_id: STORE_AUTH_APP_CLIENT_ID,
          grant_type: 'refresh_token',
          refresh_token: 'refresh-token',
        }),
      }),
    )
  })

  test('refreshStoreAccessToken throws on malformed JSON', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('not-json'),
    } as any)

    await expect(
      refreshStoreAccessToken({store: 'shop.myshopify.com', refreshToken: 'refresh-token'}),
    ).rejects.toThrow('Received an invalid refresh response from Shopify.')
  })

  test('refreshStoreAccessToken throws when access token is missing', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({refresh_token: 'fresh-refresh-token'})),
    } as any)

    await expect(
      refreshStoreAccessToken({store: 'shop.myshopify.com', refreshToken: 'refresh-token'}),
    ).rejects.toThrow('Token refresh returned an invalid response for shop.myshopify.com.')
  })

  test('fetchCurrentStoreAuthScopes returns current scope handles', async () => {
    vi.mocked(graphqlRequest).mockResolvedValue({
      currentAppInstallation: {accessScopes: [{handle: 'read_products'}, {handle: 'read_orders'}]},
    } as any)

    await expect(
      fetchCurrentStoreAuthScopes({store: 'shop.myshopify.com', accessToken: 'token'}),
    ).resolves.toEqual(['read_products', 'read_orders'])

    expect(adminUrl).toHaveBeenCalledWith('shop.myshopify.com', 'unstable')
    expect(graphqlRequest).toHaveBeenCalledWith({
      query: expect.stringContaining('currentAppInstallation'),
      api: 'Admin',
      url: 'https://shop.myshopify.com/admin/api/unstable/graphql.json',
      token: 'token',
      responseOptions: {handleErrors: false},
    })
  })

  test('fetchCurrentStoreAuthScopes throws on GraphQL lookup failure', async () => {
    vi.mocked(graphqlRequest).mockRejectedValue(new Error('shopify exploded'))

    await expect(
      fetchCurrentStoreAuthScopes({store: 'shop.myshopify.com', accessToken: 'token'}),
    ).rejects.toThrow('shopify exploded')
  })

  test('fetchCurrentStoreAuthScopes throws on invalid response shape', async () => {
    vi.mocked(graphqlRequest).mockResolvedValue({
      currentAppInstallation: undefined,
    } as any)

    await expect(
      fetchCurrentStoreAuthScopes({store: 'shop.myshopify.com', accessToken: 'token'}),
    ).rejects.toThrow('Shopify did not return currentAppInstallation.accessScopes.')
  })
})
