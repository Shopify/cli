import {isSessionExpired, loadStoredStoreSession} from './session-lifecycle.js'
import {
  clearStoredStoreAppSession,
  getCurrentStoredStoreAppSession,
  setStoredStoreAppSession,
  type StoredStoreAppSession,
} from './session-store.js'
import {refreshStoreAccessToken} from './token-client.js'
import {STORE_AUTH_APP_CLIENT_ID} from './config.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {describe, expect, test, vi} from 'vitest'

vi.mock('./session-store.js', async () => {
  // Auto-mock the storage helpers (so each test can stub their return values), but keep
  // the pure helpers (`sessionKind`, `isPreviewStoreSession`) backed by the real impl —
  // session-lifecycle branches on them and a default `vi.fn()` would return undefined.
  const actual = await vi.importActual<typeof import('./session-store.js')>('./session-store.js')
  return {
    clearStoredStoreAppSession: vi.fn(),
    getCurrentStoredStoreAppSession: vi.fn(),
    setStoredStoreAppSession: vi.fn(),
    isPreviewStoreSession: actual.isPreviewStoreSession,
    sessionKind: actual.sessionKind,
  }
})
vi.mock('./token-client.js')

function buildSession(overrides: Partial<StoredStoreAppSession> = {}): StoredStoreAppSession {
  return {
    store: 'shop.myshopify.com',
    clientId: STORE_AUTH_APP_CLIENT_ID,
    userId: '42',
    accessToken: 'token',
    refreshToken: 'refresh-token',
    scopes: ['read_products'],
    acquiredAt: '2026-03-27T00:00:00.000Z',
    associatedUser: {id: 42, email: 'merchant@example.com'},
    ...overrides,
  }
}

describe('isSessionExpired', () => {
  test('returns false when expiresAt is not set', () => {
    expect(isSessionExpired(buildSession())).toBe(false)
  })

  test('returns false when token is still valid', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    expect(isSessionExpired(buildSession({expiresAt: future}))).toBe(false)
  })

  test('returns true when token is expired', () => {
    const past = new Date(Date.now() - 60 * 1000).toISOString()
    expect(isSessionExpired(buildSession({expiresAt: past}))).toBe(true)
  })

  test('returns true within the 4-minute expiry margin', () => {
    const almostExpired = new Date(Date.now() + 3 * 60 * 1000).toISOString()
    expect(isSessionExpired(buildSession({expiresAt: almostExpired}))).toBe(true)
  })

  test('returns false just outside the 4-minute expiry margin', () => {
    const safelyValid = new Date(Date.now() + 5 * 60 * 1000).toISOString()
    expect(isSessionExpired(buildSession({expiresAt: safelyValid}))).toBe(false)
  })

  test('returns true when expiresAt is invalid', () => {
    expect(isSessionExpired(buildSession({expiresAt: 'not-a-date'}))).toBe(true)
  })
})

describe('loadStoredStoreSession', () => {
  test('throws when no stored auth exists', async () => {
    vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue(undefined)

    await expect(loadStoredStoreSession('shop.myshopify.com')).rejects.toMatchObject({
      message: 'No stored app authentication found for shop.myshopify.com.',
    })
  })

  test('returns the current stored session when it is still valid', async () => {
    const session = buildSession({expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()})
    vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue(session)

    await expect(loadStoredStoreSession('shop.myshopify.com')).resolves.toEqual(session)
    expect(refreshStoreAccessToken).not.toHaveBeenCalled()
    expect(setStoredStoreAppSession).not.toHaveBeenCalled()
  })

  test('throws when an expired session has no refresh token', async () => {
    vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue(
      buildSession({refreshToken: undefined, expiresAt: new Date(Date.now() - 60 * 1000).toISOString()}),
    )

    await expect(loadStoredStoreSession('shop.myshopify.com')).rejects.toMatchObject({
      message: 'No refresh token stored for shop.myshopify.com.',
    })
    expect(clearStoredStoreAppSession).not.toHaveBeenCalled()
  })

  test('refreshes expired sessions and persists the refreshed identity-preserving session', async () => {
    const session = buildSession({expiresAt: new Date(Date.now() - 60 * 1000).toISOString()})
    vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue(session)
    vi.mocked(refreshStoreAccessToken).mockResolvedValue({
      accessToken: 'fresh-token',
      refreshToken: 'fresh-refresh-token',
      expiresIn: 3600,
      refreshTokenExpiresIn: 7200,
    })

    const refreshed = await loadStoredStoreSession('shop.myshopify.com')

    expect(refreshStoreAccessToken).toHaveBeenCalledWith({
      store: 'shop.myshopify.com',
      refreshToken: 'refresh-token',
    })
    expect(setStoredStoreAppSession).toHaveBeenCalledWith(
      expect.objectContaining({
        store: session.store,
        clientId: session.clientId,
        userId: session.userId,
        scopes: session.scopes,
        associatedUser: session.associatedUser,
        accessToken: 'fresh-token',
        refreshToken: 'fresh-refresh-token',
      }),
    )
    expect(refreshed).toEqual(expect.objectContaining({accessToken: 'fresh-token', userId: '42'}))
  })

  test('preserves existing optional refresh fields when Shopify omits them', async () => {
    const session = buildSession({
      expiresAt: new Date(Date.now() - 60 * 1000).toISOString(),
      refreshTokenExpiresAt: '2026-04-03T00:00:00.000Z',
    })
    vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue(session)
    vi.mocked(refreshStoreAccessToken).mockResolvedValue({
      accessToken: 'fresh-token',
    })

    const refreshed = await loadStoredStoreSession('shop.myshopify.com')

    expect(refreshed.refreshToken).toBe('refresh-token')
    expect(refreshed.refreshTokenExpiresAt).toBe('2026-04-03T00:00:00.000Z')
    expect(refreshed.expiresAt).toBe(session.expiresAt)
  })

  test('clears only the current stored auth and throws re-auth when refresh fails', async () => {
    const session = buildSession({expiresAt: new Date(Date.now() - 60 * 1000).toISOString()})
    vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue(session)
    vi.mocked(refreshStoreAccessToken).mockRejectedValue(
      new AbortError('Token refresh failed for shop.myshopify.com (HTTP 401).'),
    )

    await expect(loadStoredStoreSession('shop.myshopify.com')).rejects.toMatchObject({
      message: 'Token refresh failed for shop.myshopify.com (HTTP 401).',
      tryMessage: 'To re-authenticate, run:',
    })
    expect(clearStoredStoreAppSession).toHaveBeenCalledWith('shop.myshopify.com', '42')
  })

  test('clears only the current stored auth and throws on malformed refresh JSON', async () => {
    const session = buildSession({expiresAt: new Date(Date.now() - 60 * 1000).toISOString()})
    vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue(session)
    vi.mocked(refreshStoreAccessToken).mockRejectedValue(
      new AbortError('Received an invalid refresh response from Shopify.'),
    )

    await expect(loadStoredStoreSession('shop.myshopify.com')).rejects.toThrow('Received an invalid refresh response')
    expect(clearStoredStoreAppSession).toHaveBeenCalledWith('shop.myshopify.com', '42')
  })

  test('clears only the current stored auth and throws re-auth when refresh returns an invalid response', async () => {
    const session = buildSession({expiresAt: new Date(Date.now() - 60 * 1000).toISOString()})
    vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue(session)
    vi.mocked(refreshStoreAccessToken).mockRejectedValue(
      new AbortError('Token refresh returned an invalid response for shop.myshopify.com.'),
    )

    await expect(loadStoredStoreSession('shop.myshopify.com')).rejects.toMatchObject({
      message: 'Token refresh returned an invalid response for shop.myshopify.com.',
      tryMessage: 'To re-authenticate, run:',
    })
    expect(clearStoredStoreAppSession).toHaveBeenCalledWith('shop.myshopify.com', '42')
  })

  describe('preview-store sessions', () => {
    function buildPreviewSession(overrides: Partial<StoredStoreAppSession> = {}): StoredStoreAppSession {
      return {
        store: 'preview-1.myshopify.io',
        clientId: STORE_AUTH_APP_CLIENT_ID,
        userId: 'placeholder:abc',
        accessToken: 'shpat_preview_token',
        scopes: ['read_products'],
        acquiredAt: '2026-03-27T00:00:00.000Z',
        kind: 'preview',
        preview: {
          placeholderAccountUuid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          coreUrl: 'https://app.shop.dev',
        },
        ...overrides,
      }
    }

    test('returns the preview session as-is when it has no expiresAt', async () => {
      const session = buildPreviewSession()
      vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue(session)

      await expect(loadStoredStoreSession('preview-1.myshopify.io')).resolves.toEqual(session)
      expect(refreshStoreAccessToken).not.toHaveBeenCalled()
    })

    test('never attempts a PKCE refresh for an expired preview session, even if a refreshToken is somehow present', async () => {
      // Defensive: the create-preview path never sets `refreshToken` on a preview session,
      // but if one ever sneaks in we still must not hit the OAuth refresh endpoint, which
      // the placeholder identity has no relationship with.
      const session = buildPreviewSession({
        expiresAt: new Date(Date.now() - 60 * 1000).toISOString(),
        refreshToken: 'should-be-ignored',
      })
      vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue(session)

      await expect(loadStoredStoreSession('preview-1.myshopify.io')).rejects.toMatchObject({
        message: 'Preview store session for preview-1.myshopify.io is no longer valid.',
      })
      expect(refreshStoreAccessToken).not.toHaveBeenCalled()
    })

    test('surfaces the preview-specific recovery error rather than the standard re-auth message', async () => {
      const session = buildPreviewSession({
        expiresAt: new Date(Date.now() - 60 * 1000).toISOString(),
      })
      vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue(session)

      await expect(loadStoredStoreSession('preview-1.myshopify.io')).rejects.toMatchObject({
        tryMessage: expect.stringContaining("Preview store sessions can't be refreshed"),
      })
      // The PKCE-specific next-step must not surface for preview sessions.
      await expect(loadStoredStoreSession('preview-1.myshopify.io')).rejects.not.toMatchObject({
        tryMessage: 'To re-authenticate, run:',
      })
    })
  })
})
