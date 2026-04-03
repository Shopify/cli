import {beforeEach, describe, expect, test, vi} from 'vitest'
import {fetchApiVersions} from '@shopify/cli-kit/node/api/admin'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fetch} from '@shopify/cli-kit/node/http'
import {
  clearStoredStoreAppSession,
  getCurrentStoredStoreAppSession,
  setStoredStoreAppSession,
} from './auth/session-store.js'
import {STORE_AUTH_APP_CLIENT_ID} from './auth/config.js'
import {prepareAdminStoreGraphQLContext} from './admin-graphql-context.js'

vi.mock('./auth/session-store.js')
vi.mock('@shopify/cli-kit/node/http')
vi.mock('@shopify/cli-kit/node/api/admin', async () => {
  const actual = await vi.importActual<typeof import('@shopify/cli-kit/node/api/admin')>('@shopify/cli-kit/node/api/admin')
  return {
    ...actual,
    fetchApiVersions: vi.fn(),
  }
})

describe('prepareAdminStoreGraphQLContext', () => {
  const store = 'shop.myshopify.com'
  const futureExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  const expiredAt = new Date(Date.now() - 60 * 1000).toISOString()

  const storedSession = {
    store,
    clientId: STORE_AUTH_APP_CLIENT_ID,
    userId: '42',
    accessToken: 'token',
    refreshToken: 'refresh-token',
    scopes: ['read_products'],
    acquiredAt: '2026-03-27T00:00:00.000Z',
    expiresAt: futureExpiry,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue(storedSession)
    vi.mocked(fetchApiVersions).mockResolvedValue([
      {handle: '2025-10', supported: true},
      {handle: '2025-07', supported: true},
      {handle: 'unstable', supported: false},
    ] as any)
  })

  test('returns the stored admin session and latest supported version by default', async () => {
    const result = await prepareAdminStoreGraphQLContext({store})

    expect(result).toEqual({
      adminSession: {
        token: 'token',
        storeFqdn: store,
      },
      version: '2025-10',
      sessionUserId: '42',
    })
  })

  test('refreshes expired sessions before resolving the API version', async () => {
    vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue({...storedSession, expiresAt: expiredAt})
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

    const result = await prepareAdminStoreGraphQLContext({store})

    expect(result.adminSession.token).toBe('fresh-token')
    expect(setStoredStoreAppSession).toHaveBeenCalledWith(
      expect.objectContaining({
        store,
        accessToken: 'fresh-token',
        refreshToken: 'fresh-refresh-token',
      }),
    )
  })

  test('returns the requested API version when provided', async () => {
    const result = await prepareAdminStoreGraphQLContext({store, userSpecifiedVersion: '2025-07'})

    expect(result.version).toBe('2025-07')
  })

  test('allows unstable without validating against fetched versions', async () => {
    const result = await prepareAdminStoreGraphQLContext({store, userSpecifiedVersion: 'unstable'})

    expect(result.version).toBe('unstable')
    expect(fetchApiVersions).not.toHaveBeenCalled()
  })

  test('throws when no stored auth exists', async () => {
    vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue(undefined)

    await expect(prepareAdminStoreGraphQLContext({store})).rejects.toMatchObject({
      message: `No stored app authentication found for ${store}.`,
      tryMessage: 'To create stored auth for this store, run:',
      nextSteps: [[{command: `shopify store auth --store ${store} --scopes <comma-separated-scopes>`}]],
    })
  })

  test('clears stored auth when token refresh fails', async () => {
    vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue({...storedSession, expiresAt: expiredAt})
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      text: vi.fn().mockResolvedValue('bad refresh'),
    } as any)

    await expect(prepareAdminStoreGraphQLContext({store})).rejects.toMatchObject({
      message: `Token refresh failed for ${store} (HTTP 401).`,
      tryMessage: 'To re-authenticate, run:',
      nextSteps: [[{command: `shopify store auth --store ${store} --scopes read_products`}]],
    })
    expect(clearStoredStoreAppSession).toHaveBeenCalledWith(store, '42')
  })

  test('throws when an expired session cannot be refreshed because no refresh token is stored', async () => {
    vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue({...storedSession, refreshToken: undefined, expiresAt: expiredAt})

    await expect(prepareAdminStoreGraphQLContext({store})).rejects.toMatchObject({
      message: `No refresh token stored for ${store}.`,
      tryMessage: 'To re-authenticate, run:',
      nextSteps: [[{command: `shopify store auth --store ${store} --scopes read_products`}]],
    })
    expect(clearStoredStoreAppSession).not.toHaveBeenCalled()
  })

  test('clears only the current stored auth when token refresh returns an invalid response body', async () => {
    vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue({...storedSession, expiresAt: expiredAt})
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({refresh_token: 'fresh-refresh-token'})),
    } as any)

    await expect(prepareAdminStoreGraphQLContext({store})).rejects.toMatchObject({
      message: `Token refresh returned an invalid response for ${store}.`,
      tryMessage: 'To re-authenticate, run:',
      nextSteps: [[{command: `shopify store auth --store ${store} --scopes read_products`}]],
    })
    expect(clearStoredStoreAppSession).toHaveBeenCalledWith(store, '42')
  })

  test('clears only the current stored auth when token refresh returns malformed JSON', async () => {
    vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue({...storedSession, expiresAt: expiredAt})
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('not-json'),
    } as any)

    await expect(prepareAdminStoreGraphQLContext({store})).rejects.toThrow('Received an invalid refresh response')
    expect(clearStoredStoreAppSession).toHaveBeenCalledWith(store, '42')
  })

  test('clears stored auth and prompts re-auth when API version lookup fails with invalid auth', async () => {
    vi.mocked(fetchApiVersions).mockRejectedValue(
      new AbortError(`Error connecting to your store ${store}: unauthorized 401 {}`),
    )

    await expect(prepareAdminStoreGraphQLContext({store})).rejects.toMatchObject({
      message: `Stored app authentication for ${store} is no longer valid.`,
      tryMessage: 'To re-authenticate, run:',
      nextSteps: [[{command: `shopify store auth --store ${store} --scopes read_products`}]],
    })
    expect(clearStoredStoreAppSession).toHaveBeenCalledWith(store, '42')
  })

  test('throws when the requested API version is invalid', async () => {
    await expect(prepareAdminStoreGraphQLContext({store, userSpecifiedVersion: '1999-01'})).rejects.toThrow(
      'Invalid API version',
    )
  })
})
