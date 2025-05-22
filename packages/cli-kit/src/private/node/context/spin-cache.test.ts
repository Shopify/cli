import {getCachedSpinFqdn, setCachedSpinFqdn} from './spin-cache.js'
import {describe, expect, test, beforeEach} from 'vitest'

describe('spin-cache', () => {
  beforeEach(() => {
    // Reset the cached value before each test to ensure isolation
    setCachedSpinFqdn(undefined as any)
  })

  describe('getCachedSpinFqdn', () => {
    test('returns undefined by default', () => {
      expect(getCachedSpinFqdn()).toBe(undefined)
    })

    test('returns the previously set FQDN', () => {
      setCachedSpinFqdn('example.shopify.com')
      expect(getCachedSpinFqdn()).toBe('example.shopify.com')
    })

    test('returns the most recently set FQDN', () => {
      setCachedSpinFqdn('first.shopify.com')
      setCachedSpinFqdn('second.shopify.com')
      expect(getCachedSpinFqdn()).toBe('second.shopify.com')
    })

    test('persists FQDN across multiple get calls', () => {
      setCachedSpinFqdn('persistent.shopify.com')
      expect(getCachedSpinFqdn()).toBe('persistent.shopify.com')
      expect(getCachedSpinFqdn()).toBe('persistent.shopify.com')
      expect(getCachedSpinFqdn()).toBe('persistent.shopify.com')
    })
  })

  describe('setCachedSpinFqdn', () => {
    test('sets the FQDN correctly', () => {
      setCachedSpinFqdn('test.shopify.com')
      expect(getCachedSpinFqdn()).toBe('test.shopify.com')
    })

    test('overwrites previous FQDN', () => {
      setCachedSpinFqdn('old.shopify.com')
      setCachedSpinFqdn('new.shopify.com')
      expect(getCachedSpinFqdn()).toBe('new.shopify.com')
    })

    test('handles empty string', () => {
      setCachedSpinFqdn('')
      expect(getCachedSpinFqdn()).toBe('')
    })

    test('handles FQDN with subdomain', () => {
      const complexFqdn = 'my-store.example.shopify.com'
      setCachedSpinFqdn(complexFqdn)
      expect(getCachedSpinFqdn()).toBe(complexFqdn)
    })

    test('handles FQDN with port', () => {
      const fqdnWithPort = 'localhost:3000'
      setCachedSpinFqdn(fqdnWithPort)
      expect(getCachedSpinFqdn()).toBe(fqdnWithPort)
    })

    test('handles URL-like FQDN', () => {
      const urlLikeFqdn = 'https://example.shopify.com'
      setCachedSpinFqdn(urlLikeFqdn)
      expect(getCachedSpinFqdn()).toBe(urlLikeFqdn)
    })

    test('handles multiple successive calls', () => {
      setCachedSpinFqdn('first.com')
      setCachedSpinFqdn('second.com')
      setCachedSpinFqdn('third.com')
      expect(getCachedSpinFqdn()).toBe('third.com')
    })

    test('handles special characters in FQDN', () => {
      const specialFqdn = 'test-store_123.example.shopify.com'
      setCachedSpinFqdn(specialFqdn)
      expect(getCachedSpinFqdn()).toBe(specialFqdn)
    })

    test('handles very long FQDN', () => {
      const longFqdn = `${'a'.repeat(100)}.shopify.com`
      setCachedSpinFqdn(longFqdn)
      expect(getCachedSpinFqdn()).toBe(longFqdn)
    })
  })

  describe('state isolation', () => {
    test('modifications affect all subsequent calls in same context', () => {
      setCachedSpinFqdn('initial.com')
      expect(getCachedSpinFqdn()).toBe('initial.com')

      setCachedSpinFqdn('updated.com')
      expect(getCachedSpinFqdn()).toBe('updated.com')
    })

    test('can handle undefined-like values', () => {
      setCachedSpinFqdn('test.com')
      expect(getCachedSpinFqdn()).toBe('test.com')

      // Test setting to undefined (though TypeScript prevents this, testing runtime behavior)
      setCachedSpinFqdn(undefined as any)
      expect(getCachedSpinFqdn()).toBe(undefined)
    })
  })
})
