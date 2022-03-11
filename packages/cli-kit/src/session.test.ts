import {
  vi,
  describe,
  expect,
  it,
  beforeAll,
  afterEach,
  beforeEach,
} from 'vitest'

import {validateScopes, validateSession} from './session/validate'
import {allDefaultScopes} from './session/scopes'
import {store as secureStore, fetch as secureFetch} from './session/store'
import {ApplicationToken, IdentityToken, Session} from './session/schema'
import {
  exchangeAccessForApplicationTokens,
  exchangeCodeForAccessToken,
} from './session/exchange'
import {ensureAuthenticated, OAuthApplications} from './session'
import {identity} from './environment/fqdn'
import {authorize} from './session/authorize'

const pastDate = new Date(2022, 1, 1, 9)
const currentDate = new Date(2022, 1, 1, 10)
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

const appTokens: {[x: string]: ApplicationToken} = {
  // Admin APIs includes domain in the key
  'mystore-appId': {
    accessToken: 'access_token',
    expiresAt: futureDate,
    scopes: ['scope', 'scope2'],
  },
  appId1: {
    accessToken: 'access_token',
    expiresAt: futureDate,
    scopes: ['scope1'],
  },
  appId2: {
    accessToken: 'access_token',
    expiresAt: futureDate,
    scopes: ['scope2'],
  },
}

const fqdn = 'fqdn.com'

const validSession: Session = {
  [fqdn]: {
    identity: validIdentityToken,
    applications: appTokens,
  },
}

describe('ensureAuthenticated when previous session is invalid', () => {
  beforeAll(() => {
    vi.mock('./environment/fqdn')
    vi.mock('./session/identity')
    vi.mock('./session/authorize')
    vi.mock('./session/exchange')
    vi.mock('./session/scopes')
    vi.mock('./session/store')
    vi.mock('./session/validate')

    vi.mocked(allDefaultScopes).mockImplementation((scopes) => scopes || [])
  })

  beforeEach(() => {
    vi.mocked(identity).mockResolvedValue(fqdn)
    vi.mocked(authorize).mockResolvedValue(code)
    vi.mocked(exchangeCodeForAccessToken).mockResolvedValue(validIdentityToken)
    vi.mocked(exchangeAccessForApplicationTokens).mockResolvedValue(appTokens)
  })

  afterEach(() => {
    // There is an open issue where mocks are not resetted automatically after each test
    // even if you call clearAllMocks() or with the clearMocks config
    // https://github.com/vitest-dev/vitest/issues/872
    vi.mocked(authorize).mockClear()
    vi.mocked(exchangeCodeForAccessToken).mockClear()
    vi.mocked(exchangeAccessForApplicationTokens).mockClear()
    vi.mocked(secureStore).mockClear()
  })

  it('executes complete auth flow if there is no session', async () => {
    const expectedSession: Session = {
      [fqdn]: {
        identity: validIdentityToken,
        applications: appTokens,
      },
    }
    vi.mocked(secureFetch).mockResolvedValue(undefined)

    // When
    await ensureAuthenticated(defaultApplications)

    // Then
    expect(authorize).toHaveBeenCalledOnce()
    expect(exchangeCodeForAccessToken).toBeCalled()
    expect(exchangeAccessForApplicationTokens).toBeCalled()
    expect(secureStore).toBeCalledWith(expectedSession)
  })

  it('executes complete auth flow if session is for a different fqdn', async () => {
    const invalidSession: Session = {
      randomFQDN: {
        identity: validIdentityToken,
        applications: appTokens,
      },
    }
    const expectedSession: Session = {
      [fqdn]: {
        identity: validIdentityToken,
        applications: appTokens,
      },
    }
    vi.mocked(secureFetch).mockResolvedValue(invalidSession)

    const newSession: Session = {...invalidSession, ...expectedSession}

    // When
    await ensureAuthenticated(defaultApplications)

    // Then

    expect(authorize).toHaveBeenCalledOnce()
    expect(exchangeCodeForAccessToken).toBeCalled()
    expect(exchangeAccessForApplicationTokens).toBeCalled()
    expect(secureStore).toBeCalledWith(newSession)
  })

  it('executes complete auth flow if requesting additional scopes', async () => {
    vi.mocked(validateScopes).mockReturnValue(true)
    vi.mocked(validateSession).mockReturnValue(true)
    const invalidSession: Session = {
      [fqdn]: {
        identity: validIdentityToken,
        applications: appTokens,
      },
    }
    const expectedSession: Session = {
      [fqdn]: {
        identity: validIdentityToken,
        applications: appTokens,
      },
    }
    vi.mocked(secureFetch).mockResolvedValue(invalidSession)
    // When
    await ensureAuthenticated(defaultApplications)
    // Then
    expect(authorize).not.toHaveBeenCalled()
    expect(exchangeCodeForAccessToken).not.toBeCalled()
    expect(exchangeAccessForApplicationTokens).not.toBeCalled()
    expect(secureStore).not.toBeCalled()
  })
})

describe('ensureAuthenticated when there is a previous invalid session', () => {
  it('executes complete flow if the older session has less scopes', () => {})
})

describe('ensureAuthenticated when there is a previous session for same fqdn and identity token has valid scopes', () => {
  it('does nothing if session is not expired and has valid scopes', () => {})
  it('refreshes all tokens if session is expired', () => {})
  it('refreshes app tokens if any app is expired', () => {})
  it('refreshes app tokens if admin needs a new store', () => {})
  it('refreshes app tokens if we are missing app tokens', () => {})
})
