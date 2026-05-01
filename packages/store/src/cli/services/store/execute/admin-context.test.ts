import {prepareAdminStoreGraphQLContext} from './admin-context.js'
import {fetchPublicApiVersions} from './admin-transport.js'
import {loadStoredStoreSession} from '../auth/session-lifecycle.js'
import {STORE_AUTH_APP_CLIENT_ID} from '../auth/config.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../auth/session-lifecycle.js', () => ({loadStoredStoreSession: vi.fn()}))
vi.mock('./admin-transport.js', () => ({
  fetchPublicApiVersions: vi.fn(),
  // runAdminStoreGraphQLOperation isn't exercised here, but we re-export it for type completeness.
  runAdminStoreGraphQLOperation: vi.fn(),
}))

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
    vi.mocked(loadStoredStoreSession).mockResolvedValue(storedSession)
    vi.mocked(fetchPublicApiVersions).mockResolvedValue([
      {handle: '2025-10', supported: true},
      {handle: '2025-07', supported: true},
      {handle: 'unstable', supported: false},
    ])
  })

  test('returns the stored admin session, version, and full auth session', async () => {
    const result = await prepareAdminStoreGraphQLContext({store})

    expect(loadStoredStoreSession).toHaveBeenCalledWith(store)
    expect(fetchPublicApiVersions).toHaveBeenCalledWith({
      adminSession: {token: 'token', storeFqdn: store},
      session: storedSession,
    })
    expect(result).toEqual({
      adminSession: {token: 'token', storeFqdn: store},
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

    expect(fetchPublicApiVersions).toHaveBeenCalledWith({
      adminSession: {token: 'fresh-token', storeFqdn: store},
      session: refreshedSession,
    })
    expect(result.adminSession.token).toBe('fresh-token')
    expect(result.session).toEqual(refreshedSession)
  })

  test('returns the requested API version when provided', async () => {
    const result = await prepareAdminStoreGraphQLContext({store, userSpecifiedVersion: '2025-07'})

    expect(result.version).toBe('2025-07')
  })

  test('allows unstable without consulting the transport, but still loads the stored session', async () => {
    const result = await prepareAdminStoreGraphQLContext({store, userSpecifiedVersion: 'unstable'})

    expect(loadStoredStoreSession).toHaveBeenCalledWith(store)
    expect(result).toEqual({
      adminSession: {token: 'token', storeFqdn: store},
      version: 'unstable',
      session: storedSession,
    })
    expect(fetchPublicApiVersions).not.toHaveBeenCalled()
  })

  test('throws when the requested API version is invalid', async () => {
    await expect(prepareAdminStoreGraphQLContext({store, userSpecifiedVersion: '1999-01'})).rejects.toThrow(
      'Invalid API version',
    )
  })

  test('rethrows whatever the transport raises (errors are owned by the transport)', async () => {
    vi.mocked(fetchPublicApiVersions).mockRejectedValue(new AbortError('upstream exploded'))

    await expect(prepareAdminStoreGraphQLContext({store})).rejects.toThrow('upstream exploded')
  })
})
