import {ensureAuthenticated, OAuthApplications, OAuthSession} from './session.js'
import {
  exchangeAccessForApplicationTokens,
  exchangeCodeForAccessToken,
  exchangeCustomPartnerToken,
  refreshAccessToken,
  InvalidGrantError,
} from './session/exchange.js'
import {authorize} from './session/authorize.js'
import {allDefaultScopes} from './session/scopes.js'
import {store as secureStore, fetch as secureFetch} from './session/store.js'

import {ApplicationToken, IdentityToken, Session} from './session/schema.js'
import {validateSession} from './session/validate.js'
import {applicationId} from './session/identity.js'
import * as fqdnModule from '../../public/node/context/fqdn.js'
import {useDeviceAuth} from '../../public/node/context/local.js'
import {partnersRequest} from '../../public/node/api/partners.js'
import {getPartnersToken} from '../../public/node/environment.js'
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
}

const validTokens: OAuthSession = {
  admin: {token: 'admin_token', storeFqdn: 'mystore.myshopify.com'},
  storefront: 'storefront_token',
  partners: 'partners_token',
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

beforeEach(() => {
  vi.spyOn(fqdnModule, 'identityFqdn').mockResolvedValue(fqdn)
  vi.mocked(useDeviceAuth).mockReturnValue(false)
  vi.mocked(authorize).mockResolvedValue(code)
  vi.mocked(exchangeCodeForAccessToken).mockResolvedValue(validIdentityToken)
  vi.mocked(exchangeAccessForApplicationTokens).mockResolvedValue(appTokens)
  vi.mocked(refreshAccessToken).mockResolvedValue(validIdentityToken)
  vi.mocked(applicationId).mockImplementation((app) => app)
  vi.mocked(exchangeCustomPartnerToken).mockResolvedValue(partnersToken)
  vi.mocked(partnersRequest).mockResolvedValue(undefined)
  vi.mocked(allDefaultScopes).mockImplementation((scopes) => scopes || [])
})

describe('ensureAuthenticated when previous session is invalid', () => {
  test('executes complete auth flow if there is no session', async () => {
    // Given
    vi.mocked(validateSession).mockResolvedValueOnce('needs_full_auth')
    vi.mocked(secureFetch).mockResolvedValue(undefined)

    // When
    const got = await ensureAuthenticated(defaultApplications)

    // Then
    expect(authorize).toHaveBeenCalledOnce()
    expect(exchangeCodeForAccessToken).toBeCalled()
    expect(exchangeAccessForApplicationTokens).toBeCalled()
    expect(refreshAccessToken).not.toBeCalled()
    expect(secureStore).toBeCalledWith(validSession)
    expect(got).toEqual(validTokens)
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
    expect(authorize).not.toHaveBeenCalled()
  })

  test('executes complete auth flow if session is for a different fqdn', async () => {
    // Given
    vi.mocked(validateSession).mockResolvedValueOnce('needs_full_auth')
    vi.mocked(secureFetch).mockResolvedValue(invalidSession)
    const newSession: Session = {...invalidSession, ...validSession}

    // When
    const got = await ensureAuthenticated(defaultApplications)

    // Then
    expect(authorize).toHaveBeenCalledOnce()
    expect(exchangeCodeForAccessToken).toBeCalled()
    expect(exchangeAccessForApplicationTokens).toBeCalled()
    expect(refreshAccessToken).not.toBeCalled()
    expect(secureStore).toBeCalledWith(newSession)
    expect(got).toEqual(validTokens)
  })

  test('executes complete auth flow if requesting additional scopes', async () => {
    // Given
    vi.mocked(validateSession).mockResolvedValueOnce('needs_full_auth')
    vi.mocked(secureFetch).mockResolvedValue(validSession)

    // When
    const got = await ensureAuthenticated(defaultApplications)

    // Then
    expect(authorize).toHaveBeenCalledOnce()
    expect(exchangeCodeForAccessToken).toBeCalled()
    expect(exchangeAccessForApplicationTokens).toBeCalled()
    expect(refreshAccessToken).not.toBeCalled()
    expect(secureStore).toBeCalledWith(validSession)
    expect(got).toEqual(validTokens)
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
    expect(authorize).not.toHaveBeenCalled()
    expect(exchangeCodeForAccessToken).not.toBeCalled()
    expect(exchangeAccessForApplicationTokens).not.toBeCalled()
    expect(refreshAccessToken).not.toBeCalled()
    expect(got).toEqual(validTokens)
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
    expect(authorize).not.toHaveBeenCalled()
    expect(exchangeCodeForAccessToken).not.toBeCalled()
    expect(exchangeAccessForApplicationTokens).not.toBeCalled()
    expect(refreshAccessToken).not.toBeCalled()
    expect(got).toEqual(expected)
  })

  test('refreshes token if forceRefresh is true', async () => {
    // Given
    vi.mocked(validateSession).mockResolvedValueOnce('ok')
    vi.mocked(secureFetch).mockResolvedValue(validSession)

    // When
    const got = await ensureAuthenticated(defaultApplications, process.env, {forceRefresh: true})

    // Then
    expect(authorize).not.toHaveBeenCalledOnce()
    expect(exchangeCodeForAccessToken).not.toBeCalled()
    expect(refreshAccessToken).toBeCalled()
    expect(exchangeAccessForApplicationTokens).toBeCalled()
    expect(secureStore).toBeCalledWith(validSession)
    expect(got).toEqual(validTokens)
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
    expect(authorize).not.toHaveBeenCalledOnce()
    expect(exchangeCodeForAccessToken).not.toBeCalled()
    expect(refreshAccessToken).toBeCalled()
    expect(exchangeAccessForApplicationTokens).toBeCalled()
    expect(secureStore).toBeCalledWith(validSession)
    expect(got).toEqual(validTokens)
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
    expect(authorize).toHaveBeenCalledOnce()
    expect(exchangeCodeForAccessToken).toBeCalled()
    expect(refreshAccessToken).toBeCalled()
    expect(exchangeAccessForApplicationTokens).toBeCalled()
    expect(secureStore).toBeCalledWith(validSession)
    expect(got).toEqual(validTokens)
  })
})
