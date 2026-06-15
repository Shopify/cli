import {extractHost, extractMyshopifyHandle, isValidURL, safeParseURL} from './url.js'
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
})

describe('extractHost', () => {
  test('returns the hostname for a full URL', () => {
    expect(extractHost('https://Shop.MyShopify.com/admin')).toBe('shop.myshopify.com')
  })

  test('strips the scheme and path for a bare host string', () => {
    expect(extractHost('shop.myshopify.com/admin')).toBe('shop.myshopify.com')
  })

  test('returns undefined for null/undefined/empty input', () => {
    expect(extractHost(null)).toBeUndefined()
    expect(extractHost(undefined)).toBeUndefined()
    expect(extractHost('')).toBeUndefined()
  })
})

describe('extractMyshopifyHandle', () => {
  test('extracts the subdomain from a myshopify.com URL', () => {
    expect(extractMyshopifyHandle('https://my-shop.myshopify.com')).toBe('my-shop')
  })

  test('returns undefined when the host is not a myshopify.com domain', () => {
    expect(extractMyshopifyHandle('https://example.com')).toBeUndefined()
  })

  test('returns undefined for null/undefined input', () => {
    expect(extractMyshopifyHandle(null)).toBeUndefined()
    expect(extractMyshopifyHandle(undefined)).toBeUndefined()
  })
})
