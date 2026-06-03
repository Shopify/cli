import {sanitizeURL} from './urls.js'
import {test, expect, describe} from 'vitest'

describe('sanitizeURL', () => {
  test('sanitizes subject_token query parameter', () => {
    // Given
    const url = 'https://example.com?subject_token=abc123'

    // When
    const sanitizedUrl = sanitizeURL(url)

    // Then
    expect(sanitizedUrl).toBe('https://example.com/?subject_token=****')
  })

  test('sanitizes token query parameter', () => {
    // Given
    const url = 'https://example.com?token=abc123'

    // When
    const sanitizedUrl = sanitizeURL(url)

    // Then
    expect(sanitizedUrl).toBe('https://example.com/?token=****')
  })

  test('sanitizes multiple query parameters', () => {
    // Given
    const url = 'https://example.com?subject_token=abc123&token=def456'

    // When
    const sanitizedUrl = sanitizeURL(url)

    // Then
    expect(sanitizedUrl).toBe('https://example.com/?subject_token=****&token=****')
  })

  test('leaves other query parameters unchanged', () => {
    // Given
    const url = 'https://example.com?subject_token=abc123&other_param=def456'

    // When
    const sanitizedUrl = sanitizeURL(url)

    // Then
    expect(sanitizedUrl).toBe('https://example.com/?subject_token=****&other_param=def456')
  })

  test.each([
    'access_token',
    'refresh_token',
    'id_token',
    'subject_token',
    'actor_token',
    'device_code',
    'client_secret',
    'code',
    'token',
    'api_key',
    'secret',
    'password',
    'sig',
    'signature',
  ])('sanitizes %s query parameter', (param) => {
    // Given
    const url = `https://example.com?${param}=secret-value`

    // When
    const sanitizedUrl = sanitizeURL(url)

    // Then
    expect(sanitizedUrl).toBe(`https://example.com/?${param}=****`)
  })

  test('sanitizes all sensitive query parameters together', () => {
    // Given
    const url = 'https://example.com?access_token=a&refresh_token=b&device_code=c&subject_token=d&other=keep'

    // When
    const sanitizedUrl = sanitizeURL(url)

    // Then
    expect(sanitizedUrl).toBe(
      'https://example.com/?access_token=****&refresh_token=****&device_code=****&subject_token=****&other=keep',
    )
  })

  test('sanitizes query parameters case-insensitively', () => {
    // Given
    const url = 'https://example.com?TOKEN=abc123&Access_Token=def456'

    // When
    const sanitizedUrl = sanitizeURL(url)

    // Then
    expect(sanitizedUrl).toBe('https://example.com/?TOKEN=****&Access_Token=****')
  })

  test('sanitizes username and password in the URL', () => {
    // Given
    const url = 'https://user:pass@example.com/path?token=abc123'

    // When
    const sanitizedUrl = sanitizeURL(url)

    // Then
    expect(sanitizedUrl).toBe('https://****:****@example.com/path?token=****')
  })

  test('sanitizes only password in the URL', () => {
    // Given
    const url = 'https://:pass@example.com/path'

    // When
    const sanitizedUrl = sanitizeURL(url)

    // Then
    expect(sanitizedUrl).toBe('https://:****@example.com/path')
  })

  test('sanitizes only username in the URL', () => {
    // Given
    const url = 'https://user@example.com/path'

    // When
    const sanitizedUrl = sanitizeURL(url)

    // Then
    expect(sanitizedUrl).toBe('https://****@example.com/path')
  })
})
