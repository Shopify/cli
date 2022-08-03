import Token from './token.js'
import {expect, describe, test} from 'vitest'

describe('Token', () => {
  test('expired returns true when the token is expired', () => {
    // Given
    const expiresAt = new Date(new Date().getTime() - 86400000)
    const fqdn = 'identity.myshopify.io'
    const accessToken = 'access-token'
    const refreshToken = 'refresh-token'
    const subject = new Token({
      fqdn,
      accessToken,
      refreshToken,
      expiresAt,
      scopes: ['email'],
    })

    // When
    const got = subject.isExpired

    // Then
    expect(got).toBe(true)
  })
})
