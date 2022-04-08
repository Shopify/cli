import {applicationId} from './session/identity'
import {validateScopes, validateSession} from './session/validate'
import {allDefaultScopes} from './session/scopes'
import {store as secureStore, fetch as secureFetch} from './session/store'
import {ApplicationToken, IdentityToken, Session} from './session/schema'
import {
  exchangeAccessForApplicationTokens,
  exchangeCodeForAccessToken,
  exchangeCustomPartnerToken,
  refreshAccessToken,
  InvalidGrantError,
} from './session/exchange'
import {
  ensureAuthenticated,
  ensureAuthenticatedAdmin,
  ensureAuthenticatedPartners,
  ensureAuthenticatedStorefront,
  OAuthApplications,
  OAuthSession,
} from './session'
import {identity} from './environment/fqdn'
import {authorize} from './session/authorize'
import {vi, describe, expect, it, beforeAll, beforeEach} from 'vitest'

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
  admin: 'admin_token',
  storefront: 'storefront_token',
  partners: 'partners_token',
}

const appTokens: {[x: string]: ApplicationToken} = {
  // Admin APIs includes domain in the key
  'mystore-admin': {
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

const sessionWithoutTokens: Session = {
  [fqdn]: {
    identity: validIdentityToken,
    applications: {},
  },
}

const invalidSession: Session = {
  randomFQDN: {
    identity: validIdentityToken,
    applications: {},
  },
}

beforeAll(() => {
  vi.mock('./environment/fqdn')
  vi.mock('./session/identity')
  vi.mock('./session/authorize')
  vi.mock('./session/exchange')
  vi.mock('./session/scopes')
  vi.mock('./session/store')
  vi.mock('./session/validate')
  vi.mock('./store')

  vi.mocked(allDefaultScopes).mockImplementation((scopes) => scopes || [])
})

beforeEach(() => {
  vi.mocked(identity).mockResolvedValue(fqdn)
  vi.mocked(authorize).mockResolvedValue(code)
  vi.mocked(exchangeCodeForAccessToken).mockResolvedValue(validIdentityToken)
  vi.mocked(exchangeAccessForApplicationTokens).mockResolvedValue(appTokens)
  vi.mocked(refreshAccessToken).mockResolvedValue(validIdentityToken)
  vi.mocked(applicationId).mockImplementation((app) => app)
  vi.mocked(exchangeCustomPartnerToken).mockResolvedValue(partnersToken)
})

describe('ensureAuthenticated when previous session is invalid', () => {
  it('executes complete auth flow if there is no session', async () => {
    // Given
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

  it('executes complete auth flow if session is for a different fqdn', async () => {
    // Given
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

  it('executes complete auth flow if requesting additional scopes', async () => {
    // Given
    vi.mocked(validateScopes).mockReturnValue(false)
    vi.mocked(validateSession).mockReturnValue(true)
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
  it('does nothing', async () => {
    // Given
    vi.mocked(validateScopes).mockReturnValue(true)
    vi.mocked(validateSession).mockReturnValue(true)
    vi.mocked(secureFetch).mockResolvedValue(validSession)

    // When
    const got = await ensureAuthenticated(defaultApplications)

    // Then
    expect(authorize).not.toHaveBeenCalled()
    expect(exchangeCodeForAccessToken).not.toBeCalled()
    expect(exchangeAccessForApplicationTokens).not.toBeCalled()
    expect(refreshAccessToken).not.toBeCalled()
    expect(secureStore).toBeCalledWith(validSession)
    expect(got).toEqual(validTokens)
  })

  it('overwrites partners token if provided with a custom CLI token', async () => {
    // Given
    vi.mocked(validateScopes).mockReturnValue(true)
    vi.mocked(validateSession).mockReturnValue(true)
    vi.mocked(secureFetch).mockResolvedValue(validSession)
    const env = {SHOPIFY_CLI_PARTNERS_TOKEN: 'custom_cli_token'}
    const expected = {...validTokens, partners: 'custom_partners_token'}

    // When
    const got = await ensureAuthenticated(defaultApplications, env)

    // Then
    expect(authorize).not.toHaveBeenCalled()
    expect(exchangeCodeForAccessToken).not.toBeCalled()
    expect(exchangeAccessForApplicationTokens).not.toBeCalled()
    expect(refreshAccessToken).not.toBeCalled()
    expect(secureStore).toBeCalledWith(validSession)
    expect(got).toEqual(expected)
  })
})

describe('when existing session is expired', () => {
  it('refreshes the tokens', async () => {
    // Given
    vi.mocked(validateScopes).mockReturnValue(true)
    vi.mocked(validateSession).mockReturnValue(false)
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

  it('attempts to refresh the token and executes a complete flow if identity returns an invalid grant error', async () => {
    // Given
    const tokenResponseError = new InvalidGrantError('Invalid grant')

    vi.mocked(validateScopes).mockReturnValue(true)
    vi.mocked(validateSession).mockReturnValue(false)
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

describe('ensureAuthenticatedStorefront', () => {
  it('returns only storefront token if success', async () => {
    // Given
    vi.mocked(validateScopes).mockReturnValue(true)
    vi.mocked(validateSession).mockReturnValue(true)
    vi.mocked(secureFetch).mockResolvedValue(validSession)

    // When
    const got = await ensureAuthenticatedStorefront()

    // Then
    expect(got).toEqual('storefront_token')
  })

  it('throws error if there is no storefront token', async () => {
    // Given
    vi.mocked(validateScopes).mockReturnValue(true)
    vi.mocked(validateSession).mockReturnValue(true)
    vi.mocked(secureFetch).mockResolvedValue(sessionWithoutTokens)

    // When
    const got = ensureAuthenticatedStorefront()

    // Then
    expect(got).rejects.toThrow(`No storefront token`)
  })
})

describe('ensureAuthenticatedAdmin', () => {
  it('returns only admin token if success', async () => {
    // Given
    vi.mocked(validateScopes).mockReturnValue(true)
    vi.mocked(validateSession).mockReturnValue(true)
    vi.mocked(secureFetch).mockResolvedValue(validSession)

    // When
    const got = await ensureAuthenticatedAdmin('mystore')

    // Then
    expect(got).toEqual('admin_token')
  })

  it('throws error if there is no token', async () => {
    // Given
    vi.mocked(validateScopes).mockReturnValue(true)
    vi.mocked(validateSession).mockReturnValue(true)
    vi.mocked(secureFetch).mockResolvedValue(sessionWithoutTokens)

    // When
    const got = ensureAuthenticatedAdmin('mystore')

    // Then
    expect(got).rejects.toThrow(`No admin token`)
  })
})

describe('ensureAuthenticatedPartners', () => {
  it('returns only partners token if success', async () => {
    // Given
    vi.mocked(validateScopes).mockReturnValue(true)
    vi.mocked(validateSession).mockReturnValue(true)
    vi.mocked(secureFetch).mockResolvedValue(validSession)

    // When
    const got = await ensureAuthenticatedPartners()

    // Then
    expect(got).toEqual('partners_token')
  })

  it('throws error if there is no partners token', async () => {
    // Given
    vi.mocked(validateScopes).mockReturnValue(true)
    vi.mocked(validateSession).mockReturnValue(true)
    vi.mocked(secureFetch).mockResolvedValue(sessionWithoutTokens)

    // When
    const got = ensureAuthenticatedPartners()

    // Then
    expect(got).rejects.toThrow(`No partners token`)
  })

  it('returns custom partners token if envvar is defined', async () => {
    // Given
    vi.mocked(validateScopes).mockReturnValue(true)
    vi.mocked(validateSession).mockReturnValue(true)
    vi.mocked(secureFetch).mockResolvedValue(validSession)
    const env = {SHOPIFY_CLI_PARTNERS_TOKEN: 'custom_cli_token'}

    // When
    const got = await ensureAuthenticatedPartners([], env)

    // Then
    expect(got).toEqual('custom_partners_token')
  })
})
