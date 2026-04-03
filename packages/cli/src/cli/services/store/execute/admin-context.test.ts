import {beforeEach, describe, expect, test, vi} from 'vitest'
import {fetchApiVersions} from '@shopify/cli-kit/node/api/admin'
import {AbortError} from '@shopify/cli-kit/node/error'
import {prepareAdminStoreGraphQLContext} from './admin-context.js'
import {clearStoredStoreAppSession} from '../auth/session-store.js'
import {loadStoredStoreSession} from '../auth/session-lifecycle.js'
import {STORE_AUTH_APP_CLIENT_ID} from '../auth/config.js'

vi.mock('../auth/session-store.js')
vi.mock('../auth/session-lifecycle.js', () => ({loadStoredStoreSession: vi.fn()}))
vi.mock('@shopify/cli-kit/node/api/admin', async () => {
  const actual = await vi.importActual<typeof import('@shopify/cli-kit/node/api/admin')>('@shopify/cli-kit/node/api/admin')
  return {
    ...actual,
    fetchApiVersions: vi.fn(),
  }
})

describe('prepareAdminStoreGraphQLContext', () => {
  const store = 'shop.myshopify.com'
  const storedSession = {
    store,
    clientId: STORE_AUTH_APP_CLIENT_ID,
    userId: '42',
    accessToken: 'token',
    refreshToken: 'refresh-token',
    scopes: ['read_products', 'write_orders'],
    acquiredAt: '2026-03-27T00:00:00.000Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadStoredStoreSession).mockResolvedValue(storedSession)
    vi.mocked(fetchApiVersions).mockResolvedValue([
      {handle: '2025-10', supported: true},
      {handle: '2025-07', supported: true},
      {handle: 'unstable', supported: false},
    ] as any)
  })

  test('returns the stored admin session, version, and full auth session', async () => {
    const result = await prepareAdminStoreGraphQLContext({store})

    expect(loadStoredStoreSession).toHaveBeenCalledWith(store)
    expect(fetchApiVersions).toHaveBeenCalledWith({
      token: 'token',
      storeFqdn: store,
    })
    expect(result).toEqual({
      adminSession: {
        token: 'token',
        storeFqdn: store,
      },
      version: '2025-10',
      session: storedSession,
    })
  })

  test('uses the loaded refreshed session for both admin auth and returned context', async () => {
    const refreshedSession = {
      ...storedSession,
      accessToken: 'fresh-token',
      refreshToken: 'fresh-refresh-token',
      expiresAt: '2026-04-03T00:00:00.000Z',
    }
    vi.mocked(loadStoredStoreSession).mockResolvedValue(refreshedSession)

    const result = await prepareAdminStoreGraphQLContext({store})

    expect(fetchApiVersions).toHaveBeenCalledWith({
      token: 'fresh-token',
      storeFqdn: store,
    })
    expect(result.adminSession.token).toBe('fresh-token')
    expect(result.session).toEqual(refreshedSession)
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

  test('clears the current stored auth and prompts re-auth with real scopes when API version lookup gets invalid auth', async () => {
    vi.mocked(fetchApiVersions).mockRejectedValue(
      new AbortError(`Error connecting to your store ${store}: unauthorized 401 {}`),
    )

    await expect(prepareAdminStoreGraphQLContext({store})).rejects.toMatchObject({
      message: `Stored app authentication for ${store} is no longer valid.`,
      tryMessage: 'To re-authenticate, run:',
      nextSteps: [[{command: `shopify store auth --store ${store} --scopes read_products,write_orders`}]],
    })
    expect(clearStoredStoreAppSession).toHaveBeenCalledWith(store, '42')
  })

  test('rethrows unrelated API version lookup failures', async () => {
    vi.mocked(fetchApiVersions).mockRejectedValue(new AbortError('upstream exploded'))

    await expect(prepareAdminStoreGraphQLContext({store})).rejects.toThrow('upstream exploded')
    expect(clearStoredStoreAppSession).not.toHaveBeenCalled()
  })

  test('throws when the requested API version is invalid', async () => {
    await expect(prepareAdminStoreGraphQLContext({store, userSpecifiedVersion: '1999-01'})).rejects.toThrow(
      'Invalid API version',
    )
  })
})
