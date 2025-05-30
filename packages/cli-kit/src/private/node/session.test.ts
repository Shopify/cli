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
import {store as storeSessions, fetch as fetchSessions} from './session/store.js'
import {ApplicationToken, IdentityToken, Sessions} from './session/schema.js'
import {validateSession} from './session/validate.js'
import {applicationId} from './session/identity.js'
import {pollForDeviceAuthorization, requestDeviceAuthorization} from './session/device-authorization.js'
import {getCurrentSessionId} from './conf-store.js'
import * as fqdnModule from '../../public/node/context/fqdn.js'
import {themeToken} from '../../public/node/context/local.js'
import {partnersRequest} from '../../public/node/api/partners.js'
import {getPartnersToken} from '../../public/node/environment.js'
import {vi, describe, expect, test, beforeEach} from 'vitest'
import {nonRandomUUID} from '@shopify/cli-kit/node/crypto'

const futureDate = new Date(2022, 1, 1, 11)

const userId = '1234-5678'

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
  userId,
  alias: userId,
}

const validTokens: OAuthSession = {
  admin: {token: 'admin_token', storeFqdn: 'mystore.myshopify.com'},
  storefront: 'storefront_token',
  partners: 'partners_token',
  userId,
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
}

const partnersToken: ApplicationToken = {
  accessToken: 'custom_partners_token',
  expiresAt: futureDate,
  scopes: ['scope2'],
}

const fqdn = 'fqdn.com'

const validSessions: Sessions = {
  [fqdn]: {
    [userId]: {
      identity: validIdentityToken,
      applications: appTokens,
    },
  },
}

const invalidSessions: Sessions = {
  [fqdn]: {
    [userId]: {
      identity: validIdentityToken,
      applications: {},
    },
  },
}

vi.mock('../../public/node/context/local.js')
vi.mock('./session/identity')
vi.mock('./session/authorize')
vi.mock('./session/exchange')
vi.mock('./session/scopes')
vi.mock('./session/store')
vi.mock('./session/validate')
vi.mock('../../public/node/api/partners.js')
vi.mock('../../store')
vi.mock('../../public/node/environment.js')
vi.mock('./session/device-authorization')
vi.mock('./conf-store')

beforeEach(() => {
  vi.spyOn(fqdnModule, 'identityFqdn').mockResolvedValue(fqdn)
  vi.mocked(exchangeAccessForApplicationTokens).mockResolvedValue(appTokens)
  vi.mocked(refreshAccessToken).mockResolvedValue(validIdentityToken)
  vi.mocked(applicationId).mockImplementation((app) => app)
  vi.mocked(exchangeCustomPartnerToken).mockResolvedValue({
    accessToken: partnersToken.accessToken,
    userId: validIdentityToken.userId,
  })
  vi.mocked(partnersRequest).mockResolvedValue(undefined)
  vi.mocked(allDefaultScopes).mockImplementation((scopes) => scopes ?? [])
  setLastSeenUserIdAfterAuth(undefined as any)
  setLastSeenAuthMethod('none')

  vi.mocked(requestDeviceAuthorization).mockResolvedValue({
    deviceCode: 'device_code',
    userCode: 'user_code',
    verificationUri: 'verification_uri',
    expiresIn: 3600,
    verificationUriComplete: 'verification_uri_complete',
    interval: 5,
  })
  vi.mocked(pollForDeviceAuthorization).mockResolvedValue(validIdentityToken)
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
    expect(storeSessions).toBeCalledWith(validSessions)
    expect(got).toEqual(validTokens)

    // The userID is cached in memory and the secureStore is not accessed again
    await expect(getLastSeenUserIdAfterAuth()).resolves.toBe('1234-5678')
    await expect(getLastSeenAuthMethod()).resolves.toEqual('device_auth')
    expect(fetchSessions).toHaveBeenCalledOnce()
  })

  test('throws an error if there is no session and prompting is disabled', async () => {
    // Given
    vi.mocked(validateSession).mockResolvedValueOnce('needs_full_auth')
    vi.mocked(fetchSessions).mockResolvedValue(undefined)
    vi.mocked(getCurrentSessionId).mockReturnValue(undefined)

    // When
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    expect(ensureAuthenticated(defaultApplications, process.env, {noPrompt: true})).rejects.toThrow(
      `The currently available CLI credentials are invalid.

The CLI is currently unable to prompt for reauthentication.`,
    )

    // Then
    await expect(getLastSeenAuthMethod()).resolves.toEqual('none')

    // If there never was an auth event, the userId is 'unknown'
    await expect(getLastSeenUserIdAfterAuth()).resolves.toBe('unknown')
  })

  test('executes complete auth flow if session is for a different fqdn', async () => {
    // Given
    vi.mocked(validateSession).mockResolvedValueOnce('needs_full_auth')
    vi.mocked(fetchSessions).mockResolvedValue(invalidSessions)
    const newSession: Sessions = {...invalidSessions, ...validSessions}

    // When
    const got = await ensureAuthenticated(defaultApplications)

    // Then
    expect(exchangeAccessForApplicationTokens).toBeCalled()
    expect(refreshAccessToken).not.toBeCalled()
    expect(storeSessions).toBeCalledWith(newSession)
    expect(got).toEqual(validTokens)
    await expect(getLastSeenUserIdAfterAuth()).resolves.toBe('1234-5678')
    await expect(getLastSeenAuthMethod()).resolves.toEqual('device_auth')
    expect(fetchSessions).toHaveBeenCalledOnce()
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
    expect(storeSessions).toBeCalledWith(validSessions)
    expect(got).toEqual(validTokens)
    await expect(getLastSeenUserIdAfterAuth()).resolves.toBe('1234-5678')
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
    await expect(getLastSeenUserIdAfterAuth()).resolves.toBe('1234-5678')
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
    await expect(getLastSeenUserIdAfterAuth()).resolves.toBe('1234-5678')
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
    expect(refreshAccessToken).toBeCalled()
    expect(exchangeAccessForApplicationTokens).toBeCalled()
    expect(storeSessions).toBeCalledWith(validSessions)
    expect(got).toEqual(validTokens)
    await expect(getLastSeenUserIdAfterAuth()).resolves.toBe('1234-5678')
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
    expect(refreshAccessToken).toBeCalled()
    expect(exchangeAccessForApplicationTokens).toBeCalled()
    expect(storeSessions).toBeCalledWith(validSessions)
    expect(got).toEqual(validTokens)
    await expect(getLastSeenUserIdAfterAuth()).resolves.toBe('1234-5678')
    await expect(getLastSeenAuthMethod()).resolves.toEqual('device_auth')
    expect(fetchSessions).toHaveBeenCalledOnce()
  })

  test('attempts to refresh the token and executes a complete flow if identity returns an invalid grant error', async () => {
    // Given
    const tokenResponseError = new InvalidGrantError()

    vi.mocked(validateSession).mockResolvedValueOnce('needs_refresh')
    vi.mocked(fetchSessions).mockResolvedValue(validSessions)
    vi.mocked(refreshAccessToken).mockRejectedValueOnce(tokenResponseError)

    // When
    const got = await ensureAuthenticated(defaultApplications)

    // Then
    expect(refreshAccessToken).toBeCalled()
    expect(exchangeAccessForApplicationTokens).toBeCalled()
    expect(storeSessions).toBeCalledWith(validSessions)
    expect(got).toEqual(validTokens)
    await expect(getLastSeenUserIdAfterAuth()).resolves.toBe('1234-5678')
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

describe('ensureAuthenticated alias functionality', () => {
  test('sets alias when provided during full auth flow', async () => {
    // Given
    vi.mocked(validateSession).mockResolvedValueOnce('needs_full_auth')
    vi.mocked(fetchSessions).mockResolvedValue(undefined)
    const expectedSessionWithAlias = {
      ...validSessions,
      [fqdn]: {
        [userId]: {
          ...validSessions[fqdn]![userId]!,
          identity: {
            ...validSessions[fqdn]![userId]!.identity,
            alias: 'work-account',
          },
        },
      },
    }

    // When
    const got = await ensureAuthenticated(defaultApplications, process.env, {alias: 'work-account'})

    // Then
    expect(storeSessions).toBeCalledWith(expectedSessionWithAlias)
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

  test('sets alias during refresh token flow', async () => {
    // Given
    vi.mocked(validateSession).mockResolvedValueOnce('needs_refresh')
    vi.mocked(fetchSessions).mockResolvedValue(validSessions)
    const expectedSessionWithAlias = {
      ...validSessions,
      [fqdn]: {
        [userId]: {
          ...validSessions[fqdn]![userId]!,
          identity: {
            ...validSessions[fqdn]![userId]!.identity,
            alias: 'updated-alias',
          },
        },
      },
    }

    // When
    const got = await ensureAuthenticated(defaultApplications, process.env, {alias: 'updated-alias'})

    // Then
    expect(storeSessions).toBeCalledWith(expectedSessionWithAlias)
    expect(got).toEqual(validTokens)
  })

  test('sets alias during token refresh error fallback', async () => {
    // Given
    const tokenResponseError = new InvalidGrantError()
    vi.mocked(validateSession).mockResolvedValueOnce('needs_refresh')
    vi.mocked(fetchSessions).mockResolvedValue(validSessions)
    vi.mocked(refreshAccessToken).mockRejectedValueOnce(tokenResponseError)
    const expectedSessionWithAlias = {
      ...validSessions,
      [fqdn]: {
        [userId]: {
          ...validSessions[fqdn]![userId]!,
          identity: {
            ...validSessions[fqdn]![userId]!.identity,
            alias: 'fallback-alias',
          },
        },
      },
    }

    // When
    const got = await ensureAuthenticated(defaultApplications, process.env, {alias: 'fallback-alias'})

    // Then
    expect(storeSessions).toBeCalledWith(expectedSessionWithAlias)
    expect(got).toEqual(validTokens)
  })

  test('preserves current session alias when setting new alias to undefined', async () => {
    // Given
    vi.mocked(validateSession).mockResolvedValueOnce('ok')
    vi.mocked(fetchSessions).mockResolvedValue(validSessions)

    // When
    const got = await ensureAuthenticated(defaultApplications, process.env, {alias: undefined})

    // Then
    expect(got).toEqual(validTokens)
    // Verify the session was not stored (no change)
    expect(storeSessions).not.toHaveBeenCalled()
  })
})
