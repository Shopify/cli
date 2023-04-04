import {isValidURL} from './url.js'
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
