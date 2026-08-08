import {SessionsSchema, validateCachedIdentityTokenStructure} from './schema.js'

import {describe, expect, test} from 'vitest'

const identity = {
  accessToken: 'access',
  refreshToken: 'refresh',
  expiresAt: new Date('2030-01-01T00:00:00.000Z'),
  scopes: ['openid'],
  userId: 'user-1',
  alias: 'Work',
}

const session = {
  identity,
  applications: {partners: {accessToken: 'app', expiresAt: identity.expiresAt, scopes: ['scope']}},
}

describe('SessionsSchema', () => {
  test('accepts the documented fqdn to user ID session shape', () => {
    const result = SessionsSchema.safeParse({'accounts.shopify.com': {'user-1': session}})

    expect(result.success).toBe(true)
  })

  test('round-trips dates through JSON as ISO strings', () => {
    const serialized = JSON.stringify({'accounts.shopify.com': {'user-1': session}})
    const parsed = SessionsSchema.parse(JSON.parse(serialized))

    expect(parsed['accounts.shopify.com']!['user-1']!.identity.expiresAt).toEqual(identity.expiresAt)
    expect(parsed['accounts.shopify.com']!['user-1']!.applications.partners!.expiresAt).toEqual(identity.expiresAt)
  })

  test('accepts Date instances and ISO strings, but rejects invalid dates', () => {
    expect(SessionsSchema.safeParse({fqdn: {user: session}}).success).toBe(true)
    expect(
      SessionsSchema.safeParse({fqdn: {user: {...session, identity: {...identity, expiresAt: 'not-a-date'}}}}).success,
    ).toBe(false)
  })
})

describe('validateCachedIdentityTokenStructure', () => {
  test('accepts a valid identity token and rejects malformed structures', () => {
    expect(validateCachedIdentityTokenStructure(identity)).toBe(true)
    expect(validateCachedIdentityTokenStructure({...identity, scopes: ['scope', 1]})).toBe(false)
    expect(validateCachedIdentityTokenStructure({...identity, userId: undefined})).toBe(false)
    expect(validateCachedIdentityTokenStructure(undefined)).toBe(false)
  })
})
