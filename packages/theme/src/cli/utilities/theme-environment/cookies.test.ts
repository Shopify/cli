import {parseCookies, serializeCookies} from './cookies.js'
import {describe, test, expect} from 'vitest'

describe('cookies', () => {
  describe('parseCookie', () => {
    test('returns an empty object for an empty string', () => {
      // Given
      const input = ''

      // When
      const result = parseCookies(input)

      // Then
      expect(result).toEqual({})
    })

    test('parses a single cookie', () => {
      // Given
      const input = 'store=Snowdevil'

      // When
      const result = parseCookies(input)

      // Then
      expect(result).toEqual({store: 'Snowdevil'})
    })

    test('parses multiple cookies', () => {
      // Given
      const input = 'store=Snowdevil; tienda=Diablo de Nieve'

      // When
      const result = parseCookies(input)

      // Then
      expect(result).toEqual({store: 'Snowdevil', tienda: 'Diablo de Nieve'})
    })

    test('parses storefront cookies', () => {
      // Given
      const input = '_shopify_essential=:AA-bbb_ccc_DDD123-EEE_fff4G5ihj==:; other_cookie=:C=D=:'

      // When
      const result = parseCookies(input)

      // Then
      expect(result).toEqual({_shopify_essential: ':AA-bbb_ccc_DDD123-EEE_fff4G5ihj==:', other_cookie: ':C=D=:'})
    })

    test('trims whitespace from cookie names and values', () => {
      // Given
      const input = 'store = Snowdevil ; tienda = Diablo de Nieve '

      // When
      const result = parseCookies(input)

      // Then
      expect(result).toEqual({store: 'Snowdevil', tienda: 'Diablo de Nieve'})
    })

    test('handles cookies without a value', () => {
      // Given
      const input = 'store=; tienda=Diablo de Nieve'

      // When
      const result = parseCookies(input)

      // Then
      expect(result).toEqual({store: '', tienda: 'Diablo de Nieve'})
    })
  })

  describe('serializeCookies', () => {
    test('serializes an empty object to an empty string', () => {
      // Given
      const input = {}

      // When
      const result = serializeCookies(input)

      // Then
      expect(result).toBe('')
    })

    test('serializes a single cookie', () => {
      // Given
      const input = {store: 'Snowdevil'}

      // When
      const result = serializeCookies(input)

      // Then
      expect(result).toBe('store=Snowdevil')
    })

    test('serializes multiple cookies', () => {
      // Given
      const input = {store: 'Snowdevil', tienda: 'Diablo de Nieve'}

      // When
      const result = serializeCookies(input)

      // Then
      expect(result).toBe('store=Snowdevil; tienda=Diablo de Nieve')
    })
  })
})
