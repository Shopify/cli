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
})
