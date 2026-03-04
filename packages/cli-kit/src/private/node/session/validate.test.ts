import {validateSession} from './validate.js'
import {IdentityToken, validateCachedIdentityTokenStructure} from './schema.js'
import {expect, describe, test, vi, afterAll, beforeEach} from 'vitest'

const pastDate = new Date(2022, 1, 1, 9)
const currentDate = new Date(2022, 1, 1, 10)
const futureDate = new Date(2022, 1, 1, 11)
const requestedScopes = ['scope', 'scope2']

const validIdentity: IdentityToken = {
  accessToken: 'access_token',
  refreshToken: 'refresh',
  expiresAt: futureDate,
  scopes: ['scope', 'scope2', 'scope3'],
  userId: '1234-5678',
  alias: '1234-5678',
}

const expiredIdentity: IdentityToken = {
  accessToken: 'access_token',
  refreshToken: 'refresh',
  expiresAt: pastDate,
  scopes: ['scope', 'scope2', 'scope3'],
  userId: '1234-5678',
  alias: '1234-5678',
}

vi.mock('./identity-token-validation')
vi.mock('./schema')

beforeEach(() => {
  vi.mocked(validateCachedIdentityTokenStructure).mockReturnValue(true)
  vi.setSystemTime(currentDate)
})

afterAll(() => {
  vi.useRealTimers()
})

describe('validateSession', () => {
  test('returns ok if session is valid', async () => {
    const session = {
      identity: validIdentity,
      applications: {},
    }

    const got = await validateSession(requestedScopes, session)

    expect(got).toBe('ok')
  })

  test('returns needs_full_auth if validateCachedIdentityTokenStructure returns false', async () => {
    const session = {
      identity: validIdentity,
      applications: {},
    }
    vi.mocked(validateCachedIdentityTokenStructure).mockReturnValueOnce(false)

    const got = await validateSession(requestedScopes, session)

    expect(got).toBe('needs_full_auth')
  })

  test('returns needs_full_auth if there is no session', async () => {
    const got = await validateSession(requestedScopes, undefined)

    expect(got).toBe('needs_full_auth')
  })

  test('returns needs_full_auth if requested scopes are not included in token', async () => {
    const session = {
      identity: validIdentity,
      applications: {},
    }

    const got = await validateSession(['random_scope'], session)

    expect(got).toBe('needs_full_auth')
  })

  test('returns needs_refresh if identity token is expired', async () => {
    const session = {
      identity: expiredIdentity,
      applications: {},
    }

    const got = await validateSession(requestedScopes, session)

    expect(got).toBe('needs_refresh')
  })
})
