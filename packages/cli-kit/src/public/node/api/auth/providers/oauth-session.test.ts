import {OAuthSessionProvider} from './oauth-session.js'
import {ensureAuthenticated} from '../../../../../private/node/session.js'
import {describe, test, expect, vi} from 'vitest'

vi.mock('../../../../../private/node/session.js')

describe('OAuthSessionProvider', () => {
  test('returns partners token from ensureAuthenticated', async () => {
    vi.mocked(ensureAuthenticated).mockResolvedValue({partners: 'partners-token', userId: 'user-123'})

    const provider = new OAuthSessionProvider()
    const result = await provider.getToken('partners')

    expect(result).toBe('partners-token')
    expect(ensureAuthenticated).toHaveBeenCalledWith({partnersApi: {scopes: []}}, undefined, {
      forceRefresh: undefined,
      noPrompt: undefined,
    })
  })

  test('returns admin token from ensureAuthenticated', async () => {
    vi.mocked(ensureAuthenticated).mockResolvedValue({
      admin: {token: 'admin-token', storeFqdn: 'store.myshopify.com'},
      userId: 'user-123',
    })

    const provider = new OAuthSessionProvider()
    const result = await provider.getToken('admin', {storeFqdn: 'store.myshopify.com'})

    expect(result).toBe('admin-token')
    expect(ensureAuthenticated).toHaveBeenCalledWith(
      {adminApi: {storeFqdn: 'store.myshopify.com', scopes: []}},
      undefined,
      {forceRefresh: undefined, noPrompt: undefined},
    )
  })

  test('returns null when ensureAuthenticated returns no token for audience', async () => {
    vi.mocked(ensureAuthenticated).mockResolvedValue({userId: 'user-123'})

    const provider = new OAuthSessionProvider()
    const result = await provider.getToken('partners')

    expect(result).toBeNull()
  })

  test('passes context options through to ensureAuthenticated', async () => {
    vi.mocked(ensureAuthenticated).mockResolvedValue({
      businessPlatform: 'bp-token',
      userId: 'user-123',
    })

    const provider = new OAuthSessionProvider()
    await provider.getToken('business-platform', {forceRefresh: true, noPrompt: true, extraScopes: ['custom']})

    expect(ensureAuthenticated).toHaveBeenCalledWith({businessPlatformApi: {scopes: ['custom']}}, undefined, {
      forceRefresh: true,
      noPrompt: true,
    })
  })

  test('returns storefront token', async () => {
    vi.mocked(ensureAuthenticated).mockResolvedValue({storefront: 'sf-token', userId: 'user-123'})

    const provider = new OAuthSessionProvider()
    const result = await provider.getToken('storefront-renderer')

    expect(result).toBe('sf-token')
  })

  test('returns app-management token', async () => {
    vi.mocked(ensureAuthenticated).mockResolvedValue({appManagement: 'am-token', userId: 'user-123'})

    const provider = new OAuthSessionProvider()
    const result = await provider.getToken('app-management')

    expect(result).toBe('am-token')
  })
})
