import {configureCookies, extractSecureSessionIdFromResponseHeaders} from './dev-new.js'
import {describe, expect, test} from 'vitest'

describe('configureCookies', () => {
  // replaces secure_session_id cookie if they are present already
  // appends secure_session_id cookie if not already present in cookie string
  test('replaces secure_session_id cookie if already present', async () => {
    // Given
    const cookies = '_secure_session_id=123; other_cookie_value=some_value'

    // When
    const result = configureCookies(cookies, '789')

    // Then
    expect(result).toBe('_secure_session_id=789; other_cookie_value=some_value')
  })

  test('replaces secure_session_id cookie if present at end of string', async () => {
    // Given
    const cookies = 'other_cookie_value=some_value; _secure_session_id=123'

    // When
    const result = configureCookies(cookies, '789')

    // Then
    expect(result).toBe('other_cookie_value=some_value; _secure_session_id=789')
  })

  test('appends secure_session_id cookie if not already present', async () => {
    // Given
    const cookies = 'other_cookie_value=some_value'

    // When
    const result = configureCookies(cookies, '789')

    // Then
    expect(result).toBe('other_cookie_value=some_value; _secure_session_id=789')
  })

  test('replaces secure_session_id cookie if cookies string is empty', async () => {
    // Given
    const cookies = ''

    // When
    const result = configureCookies(cookies, '789')

    // Then
    expect(result).toBe('_secure_session_id=789')
  })
})

describe('extractSecureSessionIdFromResponseHeaders', () => {
  test('matches when secure_session_id cookie is present', async () => {
    // Given
    const cookie = ['_secure_session_id=123; other_cookie_value=some_value']

    // When
    const result = extractSecureSessionIdFromResponseHeaders(cookie)

    // Then
    expect(result).toBe('123')
  })

  test('matches when secure_session_id cookie is present at end of string', async () => {
    // Given
    const cookie = ['other_cookie_value=some_value; _secure_session_id=123']

    // When
    const result = extractSecureSessionIdFromResponseHeaders(cookie)

    // Then
    expect(result).toBe('123')
  })

  test('throws an error when secure_session_id cookie is not present', async () => {
    // Given
    const cookie = ['other_cookie_value=some_value']

    // When & Then
    expect(() => extractSecureSessionIdFromResponseHeaders(cookie)).toThrow(Error)
  })
})
