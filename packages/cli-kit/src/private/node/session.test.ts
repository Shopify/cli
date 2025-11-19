import {
  ensureAuthenticated,
  getLastSeenAuthMethod,
  getLastSeenUserIdAfterAuth,
  OAuthApplications,
  OAuthSession,
  setLastSeenAuthMethod,
  setLastSeenUserIdAfterAuth,
} from './session.js'
import {
  exchangeAccessForApplicationTokens,
  exchangeCustomPartnerToken,
  refreshAccessToken,
  InvalidGrantError,
} from './session/exchange.js'
import {allDefaultScopes} from './session/scopes.js'
import {store as storeSessions, fetch as fetchSessions, remove as secureRemove} from './session/store.js'
import {ApplicationToken, IdentityToken, Sessions} from './session/schema.js'
import {validateSession} from './session/validate.js'
import {getCurrentSessionId} from './conf-store.js'
import {getIdentityClient} from './clients/identity/instance.js'
import {IdentityMockClient} from './clients/identity/identity-mock-client.js'
import * as fqdnModule from '../../public/node/context/fqdn.js'
import {themeToken} from '../../public/node/context/local.js'
import {partnersRequest} from '../../public/node/api/partners.js'
import {businessPlatformRequest} from '../../public/node/api/business-platform.js'
import {getPartnersToken} from '../../public/node/environment.js'
import {nonRandomUUID} from '../../public/node/crypto.js'
import {terminalSupportsPrompting} from '../../public/node/system.js'
import {vi, describe, expect, test, beforeEach} from 'vitest'

const futureDate = new Date(2022, 1, 1, 11)

const mockUserId = '08978734-325e-44ce-bc65-34823a8d5180'

const defaultApplications: OAuthApplications = {
  adminApi: {storeFqdn: 'mystore', scopes: []},
  partnersApi: {scopes: []},
  storefrontRendererApi: {scopes: []},
}

const validIdentityToken: IdentityToken = {
  accessToken: 'access_token',
  refreshToken: 'refresh_token',
  expiresAt: futureDate,
  scopes: ['scope', 'scope2'],
  userId: mockUserId,
  alias: mockUserId,
}

const validTokens: OAuthSession = {
  admin: {token: 'admin_token', storeFqdn: 'mystore.myshopify.com'},
  storefront: 'storefront_token',
  partners: 'partners_token',
  userId: mockUserId,
}

const appTokens: {[x: string]: ApplicationToken} = {
  // Admin APIs includes domain in the key
  'mystore.myshopify.com-admin': {
    accessToken: 'admin_token',
    expiresAt: futureDate,
    scopes: ['scope', 'scope2'],
  },
  'storefront-renderer': {
    accessToken: 'storefront_token',
    expiresAt: futureDate,
    scopes: ['scope1'],
  },
  partners: {
    accessToken: 'partners_token',
    expiresAt: futureDate,
    scopes: ['scope2'],
  },
  'business-platform': {
    accessToken: 'business_platform_token',
    expiresAt: futureDate,
    scopes: ['scope3'],
  },
}

const partnersToken: ApplicationToken = {
  accessToken: 'custom_partners_token',
  expiresAt: futureDate,
  scopes: ['scope2'],
}

const fqdn = 'fqdn.com'

const validSessions: Sessions = {
  [fqdn]: {
    [mockUserId]: {
      identity: validIdentityToken,
      applications: appTokens,
    },
  },
}

const invalidSessions: Sessions = {
  [fqdn]: {
    [mockUserId]: {
      identity: validIdentityToken,
      applications: {},
    },
  },
}

const mockIdentityClient = new IdentityMockClient()

vi.mock('../../public/node/context/local.js')
vi.mock('./session/identity')
vi.mock('./session/authorize')
vi.mock('./session/exchange')
vi.mock('./session/scopes')
vi.mock('./session/store')
vi.mock('./session/validate')
vi.mock('../../public/node/api/partners.js')
vi.mock('../../public/node/api/business-platform.js')
vi.mock('../../store')
vi.mock('../../public/node/environment.js')
vi.mock('./session/device-authorization')
vi.mock('./conf-store')
vi.mock('../../public/node/system.js')
vi.mock('./clients/identity/instance.js')

beforeEach(() => {
  vi.spyOn(fqdnModule, 'identityFqdn').mockResolvedValue(fqdn)
  vi.mocked(exchangeAccessForApplicationTokens).mockResolvedValue(appTokens)
  vi.mocked(refreshAccessToken).mockResolvedValue(validIdentityToken)
  vi.mocked(exchangeCustomPartnerToken).mockResolvedValue({
    accessToken: partnersToken.accessToken,
    userId: validIdentityToken.userId,
  })
  vi.mocked(partnersRequest).mockResolvedValue(undefined)
  vi.mocked(allDefaultScopes).mockImplementation((scopes) => scopes ?? [])
  setLastSeenUserIdAfterAuth(undefined as any)
  setLastSeenAuthMethod('none')

  vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
  vi.mocked(businessPlatformRequest).mockResolvedValue({
    currentUserAccount: {
      email: 'user@example.com',
    },
  })

  vi.mocked(getIdentityClient).mockImplementation(() => mockIdentityClient)
  vi.spyOn(mockIdentityClient, 'applicationId').mockImplementation((app) => app)
  vi.spyOn(mockIdentityClient, 'refreshAccessToken').mockResolvedValue(validIdentityToken)
  vi.spyOn(mockIdentityClient, 'requestAccessToken').mockResolvedValue(validIdentityToken)
})

describe('ensureAuthenticated when previous session is invalid', () => {
  test('executes complete auth flow if there is no session', async () => {
    // Given
    vi.mocked(validateSession).mockResolvedValueOnce('needs_full_auth')
    vi.mocked(fetchSessions).mockResolvedValue(undefined)

    // When
    const got = await ensureAuthenticated(defaultApplications)

    // Then
    expect(exchangeAccessForApplicationTokens).toBeCalled()
    expect(refreshAccessToken).not.toBeCalled()
    expect(businessPlatformRequest).toHaveBeenCalled()
    expect(storeSessions).toHaveBeenCalledOnce()
    expect(got).toEqual(validTokens)

    // Verify the session was stored with email as alias
    const storedSession = vi.mocked(storeSessions).mock.calls[0]![0]
    expect(storedSession[fqdn]![mockUserId]!.identity.alias).toBe('user@example.com')

    // The userID is cached in memory and the secureStore is not accessed again
    await expect(getLastSeenUserIdAfterAuth()).resolves.toBe(mockUserId)
    await expect(getLastSeenAuthMethod()).resolves.toEqual('device_auth')
    expect(fetchSessions).toHaveBeenCalledOnce()
  })

  test('throws an error and logs out if there is no session and prompting is disabled,', async () => {
    // Given
    vi.mocked(validateSession).mockResolvedValueOnce('needs_full_auth')
    vi.mocked(fetchSessions).mockResolvedValue(undefined)
    vi.mocked(getCurrentSessionId).mockReturnValue(undefined)

    // When
    await expect(ensureAuthenticated(defaultApplications, process.env, {noPrompt: true})).rejects.toThrow(
      `The currently available CLI credentials are invalid.

The CLI is currently unable to prompt for reauthentication.`,
    )
    expect(secureRemove).toHaveBeenCalled()

    // Then
    await expect(getLastSeenAuthMethod()).resolves.toEqual('none')

    // If there never was an auth event, the userId is 'unknown'
    await expect(getLastSeenUserIdAfterAuth()).resolves.toBe('unknown')
  })

  test('executes complete auth flow if session is for a different fqdn', async () => {
    // Given
    vi.mocked(validateSession).mockResolvedValueOnce('needs_full_auth')
    vi.mocked(fetchSessions).mockResolvedValue(invalidSessions)
    const expectedSessions = {
      ...invalidSessions,
      [fqdn]: {
        [mockUserId]: {
          identity: {
            ...validIdentityToken,
            alias: 'user@example.com',
          },
          applications: appTokens,
        },
      },
    }

    // When
    const got = await ensureAuthenticated(defaultApplications)

    // Then
    expect(exchangeAccessForApplicationTokens).toBeCalled()
    expect(refreshAccessToken).not.toBeCalled()
    expect(storeSessions).toBeCalledWith(expectedSessions)
    expect(got).toEqual(validTokens)
    await expect(getLastSeenUserIdAfterAuth()).resolves.toBe(mockUserId)
    await expect(getLastSeenAuthMethod()).resolves.toEqual('device_auth')
    expect(fetchSessions).toHaveBeenCalledOnce()
  })

  test('falls back to userId when email fetch fails', async () => {
    // Given
    vi.mocked(validateSession).mockResolvedValueOnce('needs_full_auth')
    vi.mocked(fetchSessions).mockResolvedValue(undefined)
    vi.mocked(businessPlatformRequest).mockRejectedValueOnce(new Error('API Error'))

    // When
    const got = await ensureAuthenticated(defaultApplications)

    // Then
    expect(exchangeAccessForApplicationTokens).toBeCalled()
    expect(businessPlatformRequest).toHaveBeenCalled()
    expect(storeSessions).toHaveBeenCalledOnce()

    // Verify the session was stored with userId as alias (fallback)
    const storedSession = vi.mocked(storeSessions).mock.calls[0]![0]
    expect(storedSession[fqdn]![mockUserId]!.identity.alias).toBe(mockUserId)

    expect(got).toEqual(validTokens)
  })

  test('falls back to userId when no business platform token available', async () => {
    // Given
    vi.mocked(validateSession).mockResolvedValueOnce('needs_full_auth')
    vi.mocked(fetchSessions).mockResolvedValue(undefined)
    const appTokensWithoutBusinessPlatform = {
      'mystore.myshopify.com-admin': appTokens['mystore.myshopify.com-admin']!,
      'storefront-renderer': appTokens['storefront-renderer']!,
      partners: appTokens.partners!,
    }
    vi.mocked(exchangeAccessForApplicationTokens).mockResolvedValueOnce(appTokensWithoutBusinessPlatform)

    // When
    const got = await ensureAuthenticated(defaultApplications)

    // Then
    expect(businessPlatformRequest).not.toHaveBeenCalled()

    // Verify the session was stored with userId as alias (fallback)
    const storedSession = vi.mocked(storeSessions).mock.calls[0]![0]
    expect(storedSession[fqdn]![mockUserId]!.identity.alias).toBe(mockUserId)
  })

  test('executes complete auth flow if requesting additional scopes', async () => {
    // Given
    vi.mocked(validateSession).mockResolvedValueOnce('needs_full_auth')
    vi.mocked(fetchSessions).mockResolvedValue(validSessions)

    // When
    const got = await ensureAuthenticated(defaultApplications)

    // Then
    expect(exchangeAccessForApplicationTokens).toBeCalled()
    expect(refreshAccessToken).not.toBeCalled()
    expect(businessPlatformRequest).toHaveBeenCalled()
    expect(storeSessions).toHaveBeenCalledOnce()

    // Verify the session was stored with email as alias
    const storedSession = vi.mocked(storeSessions).mock.calls[0]![0]
    expect(storedSession[fqdn]![mockUserId]!.identity.alias).toBe('user@example.com')

    expect(got).toEqual(validTokens)
    await expect(getLastSeenUserIdAfterAuth()).resolves.toBe(mockUserId)
    await expect(getLastSeenAuthMethod()).resolves.toEqual('device_auth')
    expect(fetchSessions).toHaveBeenCalledOnce()
  })
})

describe('when existing session is valid', () => {
  test('does nothing', async () => {
    // Given
    vi.mocked(validateSession).mockResolvedValueOnce('ok')
    vi.mocked(fetchSessions).mockResolvedValue(validSessions)

    // When
    const got = await ensureAuthenticated(defaultApplications)

    // Then
    expect(exchangeAccessForApplicationTokens).not.toBeCalled()
    expect(refreshAccessToken).not.toBeCalled()
    expect(got).toEqual(validTokens)
    await expect(getLastSeenUserIdAfterAuth()).resolves.toBe(mockUserId)
    await expect(getLastSeenAuthMethod()).resolves.toEqual('device_auth')
    expect(fetchSessions).toHaveBeenCalledOnce()
  })

  test('overwrites partners token if provided with a custom CLI token', async () => {
    // Given
    vi.mocked(validateSession).mockResolvedValueOnce('ok')
    vi.mocked(fetchSessions).mockResolvedValue(validSessions)
    vi.mocked(getPartnersToken).mockReturnValue('custom_cli_token')
    const expected = {...validTokens, partners: 'custom_partners_token'}

    // When
    const got = await ensureAuthenticated(defaultApplications)

    // Then
    expect(exchangeAccessForApplicationTokens).not.toBeCalled()
    expect(refreshAccessToken).not.toBeCalled()
    expect(got).toEqual(expected)
    await expect(getLastSeenUserIdAfterAuth()).resolves.toBe(mockUserId)
    await expect(getLastSeenAuthMethod()).resolves.toEqual('partners_token')
    expect(fetchSessions).toHaveBeenCalledOnce()
  })

  test('refreshes token if forceRefresh is true', async () => {
    // Given
    vi.mocked(validateSession).mockResolvedValueOnce('ok')
    vi.mocked(fetchSessions).mockResolvedValue(validSessions)

    // When
    const got = await ensureAuthenticated(defaultApplications, process.env, {forceRefresh: true})

    // Then
    expect(mockIdentityClient.refreshAccessToken).toBeCalled()
    expect(exchangeAccessForApplicationTokens).toBeCalled()
    expect(storeSessions).toBeCalledWith(validSessions)
    expect(got).toEqual(validTokens)
    await expect(getLastSeenUserIdAfterAuth()).resolves.toBe(mockUserId)
    await expect(getLastSeenAuthMethod()).resolves.toEqual('device_auth')
    expect(fetchSessions).toHaveBeenCalledOnce()
  })
})

describe('when existing session is expired', () => {
  test('refreshes the tokens', async () => {
    // Given
    vi.mocked(validateSession).mockResolvedValueOnce('needs_refresh')
    vi.mocked(fetchSessions).mockResolvedValue(validSessions)

    // When
    const got = await ensureAuthenticated(defaultApplications)

    // Then
    expect(mockIdentityClient.refreshAccessToken).toBeCalled()
    expect(exchangeAccessForApplicationTokens).toBeCalled()
    expect(storeSessions).toBeCalledWith(validSessions)
    expect(got).toEqual(validTokens)
    await expect(getLastSeenUserIdAfterAuth()).resolves.toBe(mockUserId)
    await expect(getLastSeenAuthMethod()).resolves.toEqual('device_auth')
    expect(fetchSessions).toHaveBeenCalledOnce()
  })

  test('attempts to refresh the token and executes a complete flow if identity returns an invalid grant error', async () => {
    // Given
    const tokenResponseError = new InvalidGrantError()

    vi.mocked(validateSession).mockResolvedValueOnce('needs_refresh')
    vi.mocked(fetchSessions).mockResolvedValue(validSessions)
    vi.spyOn(mockIdentityClient, 'refreshAccessToken').mockRejectedValueOnce(tokenResponseError)

    // When
    const got = await ensureAuthenticated(defaultApplications)

    // Then
    expect(mockIdentityClient.refreshAccessToken).toBeCalled()
    expect(exchangeAccessForApplicationTokens).toBeCalled()
    expect(businessPlatformRequest).toHaveBeenCalled()
    expect(storeSessions).toHaveBeenCalledOnce()

    // Verify the session was stored with email as alias
    const storedSession = vi.mocked(storeSessions).mock.calls[0]![0]
    expect(storedSession[fqdn]![mockUserId]!.identity.alias).toBe('user@example.com')

    expect(got).toEqual(validTokens)
    await expect(getLastSeenUserIdAfterAuth()).resolves.toBe(mockUserId)
    await expect(getLastSeenAuthMethod()).resolves.toEqual('device_auth')
    expect(fetchSessions).toHaveBeenCalledOnce()
  })
})

describe('getLastSeenUserIdAfterAuth', () => {
  test('returns cached userId if available', async () => {
    // Given
    setLastSeenUserIdAfterAuth('cached-in-memory-user-id')

    // When
    const userId = await getLastSeenUserIdAfterAuth()

    // Then
    expect(userId).toBe('cached-in-memory-user-id')
    expect(fetchSessions).not.toHaveBeenCalled()
  })

  test('returns userId from local storage if not cached in memory', async () => {
    // Given
    vi.mocked(getCurrentSessionId).mockReturnValue('stored-user-id')

    // When
    const userId = await getLastSeenUserIdAfterAuth()

    // Then
    expect(userId).toBe('stored-user-id')
  })

  test('returns "unknown" if no userId is found', async () => {
    // Given
    vi.mocked(getCurrentSessionId).mockReturnValue(undefined)

    // When
    const userId = await getLastSeenUserIdAfterAuth()

    // Then
    expect(userId).toBe('unknown')
    expect(getCurrentSessionId).toHaveBeenCalled()
  })

  test('returns UUID based on theme token if present in environment', async () => {
    // Given
    vi.mocked(getCurrentSessionId).mockReturnValue(undefined)
    vi.mocked(themeToken).mockReturnValue('theme-token-123')
    // When
    const userId = await getLastSeenUserIdAfterAuth()

    // Then
    expect(userId).toBe(nonRandomUUID('theme-token-123'))
  })

  test('returns UUID based on partners token if present in environment', async () => {
    // Given
    vi.mocked(getCurrentSessionId).mockReturnValue(undefined)
    vi.mocked(getPartnersToken).mockReturnValue('partners-token-456')

    // When
    const userId = await getLastSeenUserIdAfterAuth()

    // Then
    expect(userId).not.toBe('unknown')
    expect(userId).toBe(nonRandomUUID('partners-token-456'))
  })
})

describe('setLastSeenUserIdAfterAuth', () => {
  beforeEach(() => {
    // Reset the userId before each test
    setLastSeenUserIdAfterAuth(undefined as any)
  })

  test('sets the userId correctly', async () => {
    // Given
    const testUserId = 'test-user-id-123'

    // When
    setLastSeenUserIdAfterAuth(testUserId)

    // Then
    const retrievedUserId = await getLastSeenUserIdAfterAuth()
    expect(retrievedUserId).toBe(testUserId)
  })

  test('overwrites existing userId when called multiple times', async () => {
    // Given
    const firstUserId = 'first-user-id'
    const secondUserId = 'second-user-id'

    // When
    setLastSeenUserIdAfterAuth(firstUserId)
    let retrievedUserId = await getLastSeenUserIdAfterAuth()
    expect(retrievedUserId).toBe(firstUserId)

    setLastSeenUserIdAfterAuth(secondUserId)
    retrievedUserId = await getLastSeenUserIdAfterAuth()

    // Then
    expect(retrievedUserId).toBe(secondUserId)
  })

  test('handles empty string userId', async () => {
    // Given
    const emptyUserId = ''

    // When
    setLastSeenUserIdAfterAuth(emptyUserId)

    // Then
    const retrievedUserId = await getLastSeenUserIdAfterAuth()
    // Empty string is falsy, so it falls back to 'unknown'
    expect(retrievedUserId).toBe('unknown')
  })

  test('handles undefined userId', async () => {
    // Given & When
    setLastSeenUserIdAfterAuth(undefined as any)

    // Then
    const retrievedUserId = await getLastSeenUserIdAfterAuth()
    // Undefined is falsy, so it falls back to 'unknown'
    expect(retrievedUserId).toBe('unknown')
  })

  test('persists userId across multiple getLastSeenUserIdAfterAuth calls', async () => {
    // Given
    const testUserId = 'persistent-user-id'
    setLastSeenUserIdAfterAuth(testUserId)

    // When - Call getLastSeenUserIdAfterAuth multiple times
    const firstCall = await getLastSeenUserIdAfterAuth()
    const secondCall = await getLastSeenUserIdAfterAuth()
    const thirdCall = await getLastSeenUserIdAfterAuth()

    // Then - All calls should return the same userId and fetchSessions should not be called
    expect(firstCall).toBe(testUserId)
    expect(secondCall).toBe(testUserId)
    expect(thirdCall).toBe(testUserId)
    expect(fetchSessions).not.toHaveBeenCalled()
  })
})

describe('getLastSeenAuthMethod', () => {
  beforeEach(() => {
    vi.mocked(getCurrentSessionId).mockReturnValue(undefined)
    vi.mocked(getPartnersToken).mockReturnValue(undefined)
    vi.mocked(themeToken).mockReturnValue(undefined)
    setLastSeenAuthMethod('none')
  })

  test('returns the existing authMethod if set', async () => {
    // Given
    setLastSeenAuthMethod('device_auth')

    // When
    const method = await getLastSeenAuthMethod()

    // Then
    expect(method).toBe('device_auth')
    expect(getCurrentSessionId).not.toHaveBeenCalled()
  })

  test('returns device_auth if there is a cached session', async () => {
    // Given
    vi.mocked(getCurrentSessionId).mockReturnValue('stored-user-id')

    // When
    const method = await getLastSeenAuthMethod()

    // Then
    expect(method).toBe('device_auth')
    expect(getCurrentSessionId).toHaveBeenCalledOnce()
  })

  test('returns partners_token if there is a partners token in the environment', async () => {
    // Given
    vi.mocked(getPartnersToken).mockReturnValue('partners-token-456')

    // When
    const method = await getLastSeenAuthMethod()

    // Then
    expect(method).toBe('partners_token')
    expect(getCurrentSessionId).toHaveBeenCalledOnce()
  })

  test('returns custom_app_token if there is a theme token in the environment and doesnt start with shptka_', async () => {
    // Given
    vi.mocked(themeToken).mockReturnValue('theme-token-123')

    // When
    const method = await getLastSeenAuthMethod()

    // Then
    expect(method).toBe('custom_app_token')
    expect(getCurrentSessionId).toHaveBeenCalledOnce()
  })

  test('returns theme_access_token if there is a theme token in the environment and starts with shptka_', async () => {
    // Given
    vi.mocked(themeToken).mockReturnValue('shptka_theme-token-123')

    // When
    const method = await getLastSeenAuthMethod()

    // Then
    expect(method).toBe('theme_access_token')
    expect(getCurrentSessionId).toHaveBeenCalledOnce()
  })

  test('returns none if no auth method is detected', async () => {
    // When
    const method = await getLastSeenAuthMethod()

    // Then
    expect(method).toBe('none')
    expect(getCurrentSessionId).toHaveBeenCalledOnce()
  })
})

describe('ensureAuthenticated email fetch functionality', () => {
  test('fetches and sets email as alias during full auth flow', async () => {
    // Given
    vi.mocked(validateSession).mockResolvedValueOnce('needs_full_auth')
    vi.mocked(fetchSessions).mockResolvedValue(undefined)
    vi.mocked(businessPlatformRequest).mockResolvedValueOnce({
      currentUserAccount: {
        email: 'work@example.com',
      },
    })

    // When
    const got = await ensureAuthenticated(defaultApplications)

    // Then
    const storedSession = vi.mocked(storeSessions).mock.calls[0]![0]
    expect(storedSession[fqdn]![mockUserId]!.identity.alias).toBe('work@example.com')
    expect(got).toEqual(validTokens)
  })

  test('preserves existing alias when no alias provided', async () => {
    // Given
    vi.mocked(validateSession).mockResolvedValueOnce('needs_refresh')
    vi.mocked(fetchSessions).mockResolvedValue(validSessions)

    // When
    const got = await ensureAuthenticated(defaultApplications)

    // Then
    expect(storeSessions).toBeCalledWith(validSessions)
    expect(got).toEqual(validTokens)
  })

  test('preserves existing alias during refresh token flow', async () => {
    // Given
    vi.mocked(validateSession).mockResolvedValueOnce('needs_refresh')
    vi.mocked(fetchSessions).mockResolvedValue(validSessions)

    // When
    const got = await ensureAuthenticated(defaultApplications)

    // Then
    // The email fetch is not called during refresh - the session keeps its existing alias
    expect(businessPlatformRequest).not.toHaveBeenCalled()
    expect(storeSessions).toBeCalledWith(validSessions)
    expect(got).toEqual(validTokens)
  })

  test('fetches email during token refresh error fallback', async () => {
    // Given
    const tokenResponseError = new InvalidGrantError()
    vi.mocked(validateSession).mockResolvedValueOnce('needs_refresh')
    vi.mocked(fetchSessions).mockResolvedValue(validSessions)
    vi.spyOn(mockIdentityClient, 'refreshAccessToken').mockRejectedValueOnce(tokenResponseError)
    vi.spyOn(mockIdentityClient, 'requestAccessToken').mockResolvedValueOnce(validIdentityToken)
    vi.mocked(businessPlatformRequest).mockResolvedValueOnce({
      currentUserAccount: {
        email: 'dev@shopify.com',
      },
    })

    // When
    const got = await ensureAuthenticated(defaultApplications)

    // Then
    const storedSession = vi.mocked(storeSessions).mock.calls[0]![0]
    expect(storedSession[fqdn]![mockUserId]!.identity.alias).toBe('dev@shopify.com')
    expect(got).toEqual(validTokens)
  })

  test('uses userId as alias when email is not available', async () => {
    // Given
    vi.mocked(validateSession).mockResolvedValueOnce('needs_full_auth')
    vi.mocked(fetchSessions).mockResolvedValue(undefined)
    vi.mocked(businessPlatformRequest).mockResolvedValueOnce({
      currentUserAccount: {
        email: null,
      },
    })

    // When
    const got = await ensureAuthenticated(defaultApplications)

    // Then
    const storedSession = vi.mocked(storeSessions).mock.calls[0]![0]
    expect(storedSession[fqdn]![mockUserId]!.identity.alias).toBe(mockUserId)
    expect(got).toEqual(validTokens)
  })
})
