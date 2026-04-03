import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {fetch} from '@shopify/cli-kit/node/http'
import {STORE_AUTH_APP_CLIENT_ID} from './config.js'
import {resolveExistingStoreAuthScopes} from './existing-scopes.js'
import {loadStoredStoreSession} from './session-lifecycle.js'
import {getCurrentStoredStoreAppSession} from './session-store.js'

vi.mock('./session-store.js')
vi.mock('./session-lifecycle.js', () => ({loadStoredStoreSession: vi.fn()}))
vi.mock('@shopify/cli-kit/node/http')

describe('resolveExistingStoreAuthScopes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('returns no scopes when no stored auth exists', async () => {
    vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue(undefined)

    await expect(resolveExistingStoreAuthScopes('shop.myshopify.com')).resolves.toEqual({scopes: [], authoritative: true})
    expect(loadStoredStoreSession).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  test('prefers current remote scopes over stale local scopes', async () => {
    vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue({
      store: 'shop.myshopify.com',
      clientId: STORE_AUTH_APP_CLIENT_ID,
      userId: '42',
      accessToken: 'existing-token',
      refreshToken: 'existing-refresh-token',
      scopes: ['read_orders'],
      acquiredAt: '2026-04-02T00:00:00.000Z',
    })
    vi.mocked(loadStoredStoreSession).mockResolvedValue({
      store: 'shop.myshopify.com',
      clientId: STORE_AUTH_APP_CLIENT_ID,
      userId: '42',
      accessToken: 'fresh-token',
      refreshToken: 'fresh-refresh-token',
      scopes: ['read_orders'],
      acquiredAt: '2026-04-02T00:00:00.000Z',
    } as any)
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({access_scopes: [{handle: 'read_products'}, {handle: 'read_customers'}]})),
    } as any)

    await expect(resolveExistingStoreAuthScopes('shop.myshopify.com')).resolves.toEqual({
      scopes: ['read_products', 'read_customers'],
      authoritative: true,
    })
    expect(fetch).toHaveBeenCalledWith(
      'https://shop.myshopify.com/admin/oauth/access_scopes.json',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({'X-Shopify-Access-Token': 'fresh-token'}),
      }),
    )
  })

  test('falls back to locally stored scopes when remote lookup fails', async () => {
    vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue({
      store: 'shop.myshopify.com',
      clientId: STORE_AUTH_APP_CLIENT_ID,
      userId: '42',
      accessToken: 'existing-token',
      refreshToken: 'existing-refresh-token',
      scopes: ['read_orders'],
      acquiredAt: '2026-04-02T00:00:00.000Z',
    })
    vi.mocked(loadStoredStoreSession).mockRejectedValue(new Error('boom'))

    await expect(resolveExistingStoreAuthScopes('shop.myshopify.com')).resolves.toEqual({
      scopes: ['read_orders'],
      authoritative: false,
    })
  })

  test('falls back to locally stored scopes when access scopes request fails', async () => {
    vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue({
      store: 'shop.myshopify.com',
      clientId: STORE_AUTH_APP_CLIENT_ID,
      userId: '42',
      accessToken: 'existing-token',
      refreshToken: 'existing-refresh-token',
      scopes: ['read_orders'],
      acquiredAt: '2026-04-02T00:00:00.000Z',
    })
    vi.mocked(loadStoredStoreSession).mockResolvedValue({
      store: 'shop.myshopify.com',
      clientId: STORE_AUTH_APP_CLIENT_ID,
      userId: '42',
      accessToken: 'fresh-token',
      refreshToken: 'fresh-refresh-token',
      scopes: ['read_orders'],
      acquiredAt: '2026-04-02T00:00:00.000Z',
    } as any)
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: vi.fn().mockResolvedValue('shopify exploded'),
    } as any)

    await expect(resolveExistingStoreAuthScopes('shop.myshopify.com')).resolves.toEqual({
      scopes: ['read_orders'],
      authoritative: false,
    })
  })

  test('falls back to locally stored scopes when access scopes response is invalid', async () => {
    vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue({
      store: 'shop.myshopify.com',
      clientId: STORE_AUTH_APP_CLIENT_ID,
      userId: '42',
      accessToken: 'existing-token',
      refreshToken: 'existing-refresh-token',
      scopes: ['read_orders'],
      acquiredAt: '2026-04-02T00:00:00.000Z',
    })
    vi.mocked(loadStoredStoreSession).mockResolvedValue({
      store: 'shop.myshopify.com',
      clientId: STORE_AUTH_APP_CLIENT_ID,
      userId: '42',
      accessToken: 'fresh-token',
      refreshToken: 'fresh-refresh-token',
      scopes: ['read_orders'],
      acquiredAt: '2026-04-02T00:00:00.000Z',
    } as any)
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('{"not_access_scopes":[]}'),
    } as any)

    await expect(resolveExistingStoreAuthScopes('shop.myshopify.com')).resolves.toEqual({
      scopes: ['read_orders'],
      authoritative: false,
    })
  })
})
