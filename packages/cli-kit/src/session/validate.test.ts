import {applicationId} from './identity'
import {IdentityToken} from './schema'
import {validateScopes, validateSession} from './validate'
import {OAuthApplications} from '../session'
import {expect, describe, it, vi, afterAll, beforeEach} from 'vitest'

const pastDate = new Date(2022, 1, 1, 9)
const currentDate = new Date(2022, 1, 1, 10)
const futureDate = new Date(2022, 1, 1, 11)
const storeName = 'store.myshopify.io'

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
})

afterAll(() => {
  // Restore Date mock
  vi.useRealTimers()
})

describe('validateScopes', () => {
  it('returns true if requested scopes are included in token', () => {
    // Given
    const requestedScopes = ['scope', 'scope2']

    // When
    const got = validateScopes(requestedScopes, validIdentity)

    // Then
    expect(got).toBe(true)
  })

  it('returns false if requested scopes are not included in token', () => {
    // Given
    const requestedScopes = ['scope4', 'scope5']

    // When
    const got = validateScopes(requestedScopes, validIdentity)

    // Then
    expect(got).toBe(false)
  })
})

describe('validateSession', () => {
  it('returns true if session is valid', () => {
    // Given
    const session = {
      identity: validIdentity,
      applications: validApplications,
    }

    // When
    const got = validateSession(defaultApps, session)

    // Then
    expect(got).toBe(true)
  })

  it('returns false if there is no session', () => {
    // Given
    const session: any = undefined

    // When
    const got = validateSession(defaultApps, session)

    // Then
    expect(got).toBe(false)
  })

  it('returns false if identity is expired', () => {
    // Given
    const session = {
      identity: expiredIdentity,
      applications: validApplications,
    }

    // When
    const got = validateSession(defaultApps, session)

    // Then
    expect(got).toBe(false)
  })

  it('returns false if requesting partners and is expired', () => {
    // Given
    const applications = {
      partnersApi: {scopes: []},
    }
    const session = {
      identity: validIdentity,
      applications: expiredApplications,
    }

    // When
    const got = validateSession(applications, session)

    // Then
    expect(got).toBe(false)
  })

  it('returns false if requesting storefront and is expired', () => {
    // Given
    const applications = {
      storefrontRendererApi: {scopes: []},
    }
    const session = {
      identity: validIdentity,
      applications: expiredApplications,
    }

    // When
    const got = validateSession(applications, session)

    // Then
    expect(got).toBe(false)
  })

  it('returns false if requesting admin and is expired', () => {
    // Given
    const applications: OAuthApplications = {
      adminApi: {scopes: [], storeFqdn: storeName},
    }
    const session = {
      identity: validIdentity,
      applications: expiredApplications,
    }

    // When
    const got = validateSession(applications, session)

    // Then
    expect(got).toBe(false)
  })

  it('returns false if session does not include requested store', () => {
    // Given
    const applications: OAuthApplications = {
      adminApi: {scopes: [], storeFqdn: 'NotMyStore'},
    }
    const session = {
      identity: validIdentity,
      applications: validApplications,
    }

    // When
    const got = validateSession(applications, session)

    // Then
    expect(got).toBe(false)
  })
})
