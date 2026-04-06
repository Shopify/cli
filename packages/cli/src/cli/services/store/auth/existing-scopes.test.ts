import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {adminUrl} from '@shopify/cli-kit/node/api/admin'
import {graphqlRequest} from '@shopify/cli-kit/node/api/graphql'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {STORE_AUTH_APP_CLIENT_ID} from './config.js'
import {resolveExistingStoreAuthScopes} from './existing-scopes.js'
import {loadStoredStoreSession} from './session-lifecycle.js'
import {getCurrentStoredStoreAppSession} from './session-store.js'

vi.mock('./session-store.js')
vi.mock('./session-lifecycle.js', () => ({loadStoredStoreSession: vi.fn()}))
vi.mock('@shopify/cli-kit/node/api/graphql')
vi.mock('@shopify/cli-kit/node/api/admin', async () => {
  const actual = await vi.importActual<typeof import('@shopify/cli-kit/node/api/admin')>('@shopify/cli-kit/node/api/admin')
  return {
    ...actual,
    adminUrl: vi.fn(),
  }
})

describe('resolveExistingStoreAuthScopes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(adminUrl).mockReturnValue('https://shop.myshopify.com/admin/api/unstable/graphql.json')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    mockAndCaptureOutput().clear()
  })

  test('returns no scopes when no stored auth exists', async () => {
    vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue(undefined)

    await expect(resolveExistingStoreAuthScopes('shop.myshopify.com')).resolves.toEqual({scopes: [], authoritative: true})
    expect(loadStoredStoreSession).not.toHaveBeenCalled()
    expect(graphqlRequest).not.toHaveBeenCalled()
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
    vi.mocked(graphqlRequest).mockResolvedValue({
      currentAppInstallation: {accessScopes: [{handle: 'read_products'}, {handle: 'read_customers'}]},
    } as any)

    await expect(resolveExistingStoreAuthScopes('shop.myshopify.com')).resolves.toEqual({
      scopes: ['read_products', 'read_customers'],
      authoritative: true,
    })
    expect(adminUrl).toHaveBeenCalledWith('shop.myshopify.com', 'unstable')
    expect(graphqlRequest).toHaveBeenCalledWith({
      query: expect.stringContaining('currentAppInstallation'),
      api: 'Admin',
      url: 'https://shop.myshopify.com/admin/api/unstable/graphql.json',
      token: 'fresh-token',
      responseOptions: {handleErrors: false},
    })
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
    const output = mockAndCaptureOutput()

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
    const scopeLookupError = new Error('GraphQL Error (Code: 401)')
    Object.assign(scopeLookupError, {
      response: {
        status: 401,
        errors: '[API] Invalid API key or access token (unrecognized login or wrong password)',
      },
      request: {
        query: '#graphql query CurrentAppInstallationAccessScopes { currentAppInstallation { accessScopes { handle } } }',
      },
    })
    vi.mocked(graphqlRequest).mockRejectedValue(scopeLookupError)

    await expect(resolveExistingStoreAuthScopes('shop.myshopify.com')).resolves.toEqual({
      scopes: ['read_orders'],
      authoritative: false,
    })
    expect(output.debug()).toContain('after remote scope lookup failed: HTTP 401: [API] Invalid API key or access token')
    expect(output.debug()).not.toContain('CurrentAppInstallationAccessScopes')
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
    vi.mocked(graphqlRequest).mockResolvedValue({
      currentAppInstallation: undefined,
    } as any)

    await expect(resolveExistingStoreAuthScopes('shop.myshopify.com')).resolves.toEqual({
      scopes: ['read_orders'],
      authoritative: false,
    })
  })
})
