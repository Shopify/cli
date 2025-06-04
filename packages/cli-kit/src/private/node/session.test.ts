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
import {store as secureStore, fetch as secureFetch} from './session/store.js'

import {ApplicationToken, IdentityToken, Session} from './session/schema.js'
import {validateSession} from './session/validate.js'
import {applicationId} from './session/identity.js'
import {pollForDeviceAuthorization, requestDeviceAuthorization} from './session/device-authorization.js'
import * as fqdnModule from '../../public/node/context/fqdn.js'
import {themeToken} from '../../public/node/context/local.js'
import {partnersRequest} from '../../public/node/api/partners.js'
import {getPartnersToken} from '../../public/node/environment.js'
import {nonRandomUUID} from '../../public/node/crypto.js'
import {vi, describe, expect, test, beforeEach} from 'vitest'

const futureDate = new Date(2022, 1, 1, 11)

const code = {code: 'code', codeVerifier: 'verifier'}

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
  userId: '1234-5678',
}

const validTokens: OAuthSession = {
  admin: {token: 'admin_token', storeFqdn: 'mystore.myshopify.com'},
  storefront: 'storefront_token',
  partners: 'partners_token',
  userId: '1234-5678',
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

const validSession: Session = {
  [fqdn]: {
    identity: validIdentityToken,
    applications: appTokens,
  },
}

const invalidSession: Session = {
  randomFQDN: {
    identity: validIdentityToken,
    applications: {},
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
  vi.mocked(allDefaultScopes).mockImplementation((scopes) => scopes || [])
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
    vi.mocked(secureFetch).mockResolvedValue(undefined)

    // When
    const got = await ensureAuthenticated(defaultApplications)

    // Then
    expect(exchangeAccessForApplicationTokens).toBeCalled()
    expect(refreshAccessToken).not.toBeCalled()
    expect(secureStore).toBeCalledWith(validSession)
    expect(got).toEqual(validTokens)

    // The userID is cached in memory and the secureStore is not accessed again
    await expect(getLastSeenUserIdAfterAuth()).resolves.toBe('1234-5678')
    await expect(getLastSeenAuthMethod()).resolves.toEqual('device_auth')
    expect(secureFetch).toHaveBeenCalledOnce()
  })

  test('throws an error if there is no session and prompting is disabled', async () => {
    // Given
    vi.mocked(validateSession).mockResolvedValueOnce('needs_full_auth')
    vi.mocked(secureFetch).mockResolvedValue(undefined)

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
    vi.mocked(secureFetch).mockResolvedValue(invalidSession)
    const newSession: Session = {...invalidSession, ...validSession}

    // When
    const got = await ensureAuthenticated(defaultApplications)

    // Then
    expect(exchangeAccessForApplicationTokens).toBeCalled()
    expect(refreshAccessToken).not.toBeCalled()
    expect(secureStore).toBeCalledWith(newSession)
    expect(got).toEqual(validTokens)
    await expect(getLastSeenUserIdAfterAuth()).resolves.toBe('1234-5678')
    await expect(getLastSeenAuthMethod()).resolves.toEqual('device_auth')
    expect(secureFetch).toHaveBeenCalledOnce()
  })

  test('executes complete auth flow if requesting additional scopes', async () => {
    // Given
    vi.mocked(validateSession).mockResolvedValueOnce('needs_full_auth')
    vi.mocked(secureFetch).mockResolvedValue(validSession)

    // When
    const got = await ensureAuthenticated(defaultApplications)

    // Then
    expect(exchangeAccessForApplicationTokens).toBeCalled()
    expect(refreshAccessToken).not.toBeCalled()
    expect(secureStore).toBeCalledWith(validSession)
    expect(got).toEqual(validTokens)
    await expect(getLastSeenUserIdAfterAuth()).resolves.toBe('1234-5678')
    await expect(getLastSeenAuthMethod()).resolves.toEqual('device_auth')
    expect(secureFetch).toHaveBeenCalledOnce()
  })
})

describe('when existing session is valid', () => {
  test('does nothing', async () => {
    // Given
    vi.mocked(validateSession).mockResolvedValueOnce('ok')
    vi.mocked(secureFetch).mockResolvedValue(validSession)

    // When
    const got = await ensureAuthenticated(defaultApplications)

    // Then
    expect(exchangeAccessForApplicationTokens).not.toBeCalled()
    expect(refreshAccessToken).not.toBeCalled()
    expect(got).toEqual(validTokens)
    await expect(getLastSeenUserIdAfterAuth()).resolves.toBe('1234-5678')
    await expect(getLastSeenAuthMethod()).resolves.toEqual('device_auth')
    expect(secureFetch).toHaveBeenCalledOnce()
  })

  test('overwrites partners token if provided with a custom CLI token', async () => {
    // Given
    vi.mocked(validateSession).mockResolvedValueOnce('ok')
    vi.mocked(secureFetch).mockResolvedValue(validSession)
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
    expect(secureFetch).toHaveBeenCalledOnce()
  })

  test('refreshes token if forceRefresh is true', async () => {
    // Given
    vi.mocked(validateSession).mockResolvedValueOnce('ok')
    vi.mocked(secureFetch).mockResolvedValue(validSession)

    // When
    const got = await ensureAuthenticated(defaultApplications, process.env, {forceRefresh: true})

    // Then
    expect(refreshAccessToken).toBeCalled()
    expect(exchangeAccessForApplicationTokens).toBeCalled()
    expect(secureStore).toBeCalledWith(validSession)
    expect(got).toEqual(validTokens)
    await expect(getLastSeenUserIdAfterAuth()).resolves.toBe('1234-5678')
    await expect(getLastSeenAuthMethod()).resolves.toEqual('device_auth')
    expect(secureFetch).toHaveBeenCalledOnce()
  })
})

describe('when existing session is expired', () => {
  test('refreshes the tokens', async () => {
    // Given
    vi.mocked(validateSession).mockResolvedValueOnce('needs_refresh')
    vi.mocked(secureFetch).mockResolvedValue(validSession)

    // When
    const got = await ensureAuthenticated(defaultApplications)

    // Then
    expect(refreshAccessToken).toBeCalled()
    expect(exchangeAccessForApplicationTokens).toBeCalled()
    expect(secureStore).toBeCalledWith(validSession)
    expect(got).toEqual(validTokens)
    await expect(getLastSeenUserIdAfterAuth()).resolves.toBe('1234-5678')
    await expect(getLastSeenAuthMethod()).resolves.toEqual('device_auth')
    expect(secureFetch).toHaveBeenCalledOnce()
  })

  test('attempts to refresh the token and executes a complete flow if identity returns an invalid grant error', async () => {
    // Given
    const tokenResponseError = new InvalidGrantError()

    vi.mocked(validateSession).mockResolvedValueOnce('needs_refresh')
    vi.mocked(secureFetch).mockResolvedValue(validSession)
    vi.mocked(refreshAccessToken).mockRejectedValueOnce(tokenResponseError)

    // When
    const got = await ensureAuthenticated(defaultApplications)

    // Then
    expect(refreshAccessToken).toBeCalled()
    expect(exchangeAccessForApplicationTokens).toBeCalled()
    expect(secureStore).toBeCalledWith(validSession)
    expect(got).toEqual(validTokens)
    await expect(getLastSeenUserIdAfterAuth()).resolves.toBe('1234-5678')
    await expect(getLastSeenAuthMethod()).resolves.toEqual('device_auth')
    expect(secureFetch).toHaveBeenCalledOnce()
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
    expect(secureFetch).not.toHaveBeenCalled()
  })

  test('returns userId from secure store if not cached in memory', async () => {
    // Given
    const storedSession: Session = {
      [fqdn]: {
        identity: {
          userId: 'stored-user-id',
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresAt: new Date(),
          scopes: [],
        },
        applications: {},
      },
    }
    vi.mocked(secureFetch).mockResolvedValue(storedSession)

    // When
    const userId = await getLastSeenUserIdAfterAuth()

    // Then
    expect(userId).toBe('stored-user-id')
  })

  test('returns "unknown" if no userId is found', async () => {
    // Given
    vi.mocked(secureFetch).mockResolvedValue(undefined)

    // When
    const userId = await getLastSeenUserIdAfterAuth()

    // Then
    expect(userId).toBe('unknown')
    expect(secureFetch).toHaveBeenCalled()
  })

  test('returns UUID based on theme token if present in environment', async () => {
    // Given
    vi.mocked(secureFetch).mockResolvedValue(undefined)
    vi.mocked(themeToken).mockReturnValue('theme-token-123')
    // When
    const userId = await getLastSeenUserIdAfterAuth()

    // Then
    expect(userId).toBe(nonRandomUUID('theme-token-123'))
  })

  test('returns UUID based on partners token if present in environment', async () => {
    // Given
    vi.mocked(secureFetch).mockResolvedValue(undefined)
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
    vi.mocked(secureFetch).mockResolvedValue(undefined)
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
    expect(secureFetch).not.toHaveBeenCalled()
  })

  test('returns device_auth if there is a cached session', async () => {
    // Given
    vi.mocked(secureFetch).mockResolvedValue(validSession)

    // When
    const method = await getLastSeenAuthMethod()

    // Then
    expect(method).toBe('device_auth')
    expect(secureFetch).toHaveBeenCalledOnce()
  })

  test('returns partners_token if there is a partners token in the environment', async () => {
    // Given
    vi.mocked(getPartnersToken).mockReturnValue('partners-token-456')

    // When
    const method = await getLastSeenAuthMethod()

    // Then
    expect(method).toBe('partners_token')
    expect(secureFetch).toHaveBeenCalledOnce()
  })

  test('returns custom_app_token if there is a theme token in the environment and doesnt start with shptka_', async () => {
    // Given
    vi.mocked(themeToken).mockReturnValue('theme-token-123')

    // When
    const method = await getLastSeenAuthMethod()

    // Then
    expect(method).toBe('custom_app_token')
    expect(secureFetch).toHaveBeenCalledOnce()
  })

  test('returns theme_access_token if there is a theme token in the environment and starts with shptka_', async () => {
    // Given
    vi.mocked(themeToken).mockReturnValue('shptka_theme-token-123')

    // When
    const method = await getLastSeenAuthMethod()

    // Then
    expect(method).toBe('theme_access_token')
    expect(secureFetch).toHaveBeenCalledOnce()
  })

  test('returns none if no auth method is detected', async () => {
    // When
    const method = await getLastSeenAuthMethod()

    // Then
    expect(method).toBe('none')
    expect(secureFetch).toHaveBeenCalledOnce()
  })
})
