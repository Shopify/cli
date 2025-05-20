import {isValidURL, safeParseURL} from './url.js'
import {describe, expect, test} from 'vitest'

describe('isValidURL', () => {
  test('returns true if the URL is valid', () => {
    // Given/When
    const got = isValidURL('https://example.com')

    // Then
    expect(got).toBe(true)
  })

  test('returns false if the URL is empty', () => {
    // Given/When
    const got = isValidURL('')

    // Then
    expect(got).toBe(false)
  })

  test('returns false if the format is invalid', () => {
    // Given/When
    const got = isValidURL('wrong')

    // Then
    expect(got).toBe(false)
  })

  test('returns false if the URL is missing the protocol', () => {
    // Given/When
    const got = isValidURL('example.com')

    // Then
    expect(got).toBe(false)
  })

  test('throws error if URL constructor throws non-TypeError error', () => {
    // Given
    const originalURL = global.URL
    global.URL = function () {
      throw new Error('Custom error')
    } as unknown as typeof URL

    // Then
    expect(() => isValidURL('https://example.com')).toThrow('Custom error')

    // Clean up
    global.URL = originalURL
  })
})

describe('safeParseURL', () => {
  test('returns URL object for valid URL', () => {
    const validURL = 'https://shopify.com/'
    const result = safeParseURL(validURL)

    expect(result).toBeInstanceOf(URL)
    expect(result?.href).toBe(validURL)
  })

  test('returns undefined for invalid URL', () => {
    const invalidURL = 'not a url'
    const result = safeParseURL(invalidURL)

    expect(result).toBeUndefined()
  })

  test('returns undefined for empty string', () => {
    const result = safeParseURL('')

    expect(result).toBeUndefined()
  })

  test('returns undefined for any error thrown by URL constructor', () => {
    // Given
    const originalURL = global.URL
    global.URL = function () {
      throw new Error('Custom error that is not TypeError')
    } as unknown as typeof URL

    // When
    const result = safeParseURL('https://example.com')

    // Then
    expect(result).toBeUndefined()

    // Clean up
    global.URL = originalURL
  })
})
