import {applicationId} from './identity'
import {IdentityToken} from './schema'
import {validateSession} from './validate'
import {OAuthApplications} from '../session'
import {partners} from '../api'
import {expect, describe, it, vi, afterAll, beforeEach} from 'vitest'

const pastDate = new Date(2022, 1, 1, 9)
const currentDate = new Date(2022, 1, 1, 10)
const futureDate = new Date(2022, 1, 1, 11)
const storeName = 'store.myshopify.io'
const requestedScopes = ['scope', 'scope2']

const validIdentity: IdentityToken = {
  accessToken: 'access_token',
  refreshToken: 'refresh',
  expiresAt: futureDate,
  scopes: ['scope', 'scope2', 'scope3'],
}

const expiredIdentity: IdentityToken = {
  accessToken: 'access_token',
  refreshToken: 'refresh',
  expiresAt: pastDate,
  scopes: ['scope', 'scope2', 'scope3'],
}

const validApplications = {
  partners: {
    accessToken: 'access_token',
    expiresAt: futureDate,
    scopes: ['scope'],
  },
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'storefront-renderer': {
    accessToken: 'access_token',
    expiresAt: futureDate,
    scopes: ['scope'],
  },
  [`${storeName}-admin`]: {
    accessToken: 'access_token',
    expiresAt: futureDate,
    scopes: ['scope'],
  },
}

const expiredApplications = {
  partners: {
    accessToken: 'access_token',
    expiresAt: pastDate,
    scopes: ['scope'],
  },
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'storefront-renderer': {
    accessToken: 'access_token',
    expiresAt: pastDate,
    scopes: ['scope'],
  },
  [`${storeName}-admin`]: {
    accessToken: 'access_token',
    expiresAt: pastDate,
    scopes: ['scope'],
  },
}

const defaultApps: OAuthApplications = {
  partnersApi: {scopes: []},
  adminApi: {scopes: [], storeFqdn: storeName},
  storefrontRendererApi: {scopes: []},
}

beforeEach(() => {
  vi.mock('./identity')
  vi.mocked(applicationId).mockImplementation((id: any) => id)
  vi.setSystemTime(currentDate)
  vi.mock('../api')
  vi.mocked(partners.checkIfTokenIsRevoked).mockResolvedValue(false)
})

afterAll(() => {
  // Restore Date mock
  vi.useRealTimers()
})

describe('validateSession', () => {
  it('returns ok if session is valid', async () => {
    // Given
    const session = {
      identity: validIdentity,
      applications: validApplications,
    }

    // When
    const got = await validateSession(requestedScopes, defaultApps, session)

    // Then
    expect(got).toBe('ok')
  })

  it('returns needs_full_auth if there is no session', async () => {
    // Given
    const session: any = undefined

    // When
    const got = await validateSession(requestedScopes, defaultApps, session)

    // Then
    expect(got).toBe('needs_full_auth')
  })

  it('returns needs_full_auth if there is requested scopes are not included in token', async () => {
    // Given
    const session = {
      identity: validIdentity,
      applications: validApplications,
    }

    // When
    const got = await validateSession(['random_scope'], defaultApps, session)

    // Then
    expect(got).toBe('needs_full_auth')
  })

  it('returns needs_full_auth if partners token is revoked', async () => {
    // Given
    const session = {identity: validIdentity, applications: validApplications}
    vi.mocked(partners.checkIfTokenIsRevoked).mockResolvedValueOnce(true)

    // When
    const got = await validateSession(requestedScopes, defaultApps, session)

    // Then
    expect(got).toBe('needs_full_auth')
  })

  it('returns needs_refresh if identity is expired', async () => {
    // Given
    const session = {
      identity: expiredIdentity,
      applications: validApplications,
    }

    // When
    const got = await validateSession(requestedScopes, defaultApps, session)

    // Then
    expect(got).toBe('needs_refresh')
  })

  it('returns needs_refresh if requesting partners and is expired', async () => {
    // Given
    const applications = {
      partnersApi: {scopes: []},
    }
    const session = {
      identity: validIdentity,
      applications: expiredApplications,
    }

    // When
    const got = await validateSession(requestedScopes, applications, session)

    // Then
    expect(got).toBe('needs_refresh')
  })

  it('returns needs_refresh if requesting storefront and is expired', async () => {
    // Given
    const applications = {
      storefrontRendererApi: {scopes: []},
    }
    const session = {
      identity: validIdentity,
      applications: expiredApplications,
    }

    // When
    const got = await validateSession(requestedScopes, applications, session)

    // Then
    expect(got).toBe('needs_refresh')
  })

  it('returns needs_refresh if requesting admin and is expired', async () => {
    // Given
    const applications: OAuthApplications = {
      adminApi: {scopes: [], storeFqdn: storeName},
    }
    const session = {
      identity: validIdentity,
      applications: expiredApplications,
    }

    // When
    const got = await validateSession(requestedScopes, applications, session)

    // Then
    expect(got).toBe('needs_refresh')
  })

  it('returns needs_refresh if session does not include requested store', async () => {
    // Given
    const applications: OAuthApplications = {
      adminApi: {scopes: [], storeFqdn: 'NotMyStore'},
    }
    const session = {
      identity: validIdentity,
      applications: validApplications,
    }

    // When
    const got = await validateSession(requestedScopes, applications, session)

    // Then
    expect(got).toBe('needs_refresh')
  })
})
