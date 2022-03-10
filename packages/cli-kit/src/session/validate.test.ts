import {OAuthApplications} from 'session'
import {expect, describe, it, vi, beforeAll, afterAll} from 'vitest'

import {applicationId} from './identity'
import {IdentityToken} from './schema'
import {validateScopes, validateSession} from './validate'

const pastDate = new Date(2022, 1, 1, 9)
const currentDate = new Date(2022, 1, 1, 10)
const futureDate = new Date(2022, 1, 1, 11)

const identity: IdentityToken = {
  accessToken: 'access_token',
  refreshToken: 'refresh',
  expiresAt: futureDate,
  scopes: ['scope', 'scope2', 'scope3'],
}

beforeAll(() => {
  vi.mock('./identity')
  vi.mocked(applicationId).mockImplementation((id) => id)
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
    const got = validateScopes(requestedScopes, identity)

    // Then
    expect(got).toBe(true)
  })

  it('returns false if requested scopes are not included in token', () => {
    // Given
    const requestedScopes = ['scope4', 'scope5']

    // When
    const got = validateScopes(requestedScopes, identity)

    // Then
    expect(got).toBe(false)
  })
})

describe('validateSession', () => {
  it('returns false if there is no session', () => {
    // Given
    const applications: OAuthApplications = {
      partnersApi: {scopes: []},
      adminApi: {scopes: [], storeFqdn: 'store.myshopify.io'},
      storefrontRendererApi: {scopes: []},
    }
    const session: any = undefined

    // When
    const got = validateSession(applications, session)

    // Then
    expect(got).toBe(false)
  })

  it('returns false if requesting partners and is expired', () => {
    // Given
    const applications: OAuthApplications = {
      partnersApi: {scopes: ['scope']},
    }
    const session = {
      identity,
      applications: {
        partners: {
          accessToken: 'access_token',
          expiresAt: pastDate,
          scopes: ['scope'],
        },
      },
    }

    // When
    const got = validateSession(applications, session)

    // Then
    expect(got).toBe(false)
  })

  it('returns false if requesting storefront and is expired', () => {
    // Given
    const applications: OAuthApplications = {
      storefrontRendererApi: {scopes: ['scope']},
    }
    const session = {
      identity,
      applications: {
        'storefront-renderer': {
          accessToken: 'access_token',
          expiresAt: pastDate,
          scopes: ['scope'],
        },
      },
    }

    // When
    const got = validateSession(applications, session)

    // Then
    expect(got).toBe(false)
  })

  it('returns false if requesting admin and is expired', () => {
    // Given
    const storeName = 'store.myshopify.io'
    const applications: OAuthApplications = {
      adminApi: {scopes: ['scope'], storeFqdn: storeName},
    }
    const session = {
      identity,
      applications: {
        [`${storeName}-admin`]: {
          accessToken: 'access_token',
          expiresAt: pastDate,
          scopes: ['scope'],
        },
      },
    }

    // When
    const got = validateSession(applications, session)

    // Then
    expect(got).toBe(false)
  })

  it('returns false if requesting admin and token is missing for the store', () => {
    // Given
    const storeName = 'store.myshopify.io'
    const applications: OAuthApplications = {
      adminApi: {scopes: ['scope'], storeFqdn: storeName},
    }
    const session = {
      identity,
      applications: {
        'notMyStore-admin': {
          accessToken: 'access_token',
          expiresAt: futureDate,
          scopes: ['scope'],
        },
      },
    }

    // When
    const got = validateSession(applications, session)

    // Then
    expect(got).toBe(false)
  })
})
