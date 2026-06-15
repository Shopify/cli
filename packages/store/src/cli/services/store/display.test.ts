import {extractSubdomain, formatShortDate} from './display.js'
import {describe, expect, test} from 'vitest'

describe('formatShortDate', () => {
  test('formats an ISO timestamp as MMM DD, YYYY in UTC', () => {
    expect(formatShortDate('2026-05-22T16:26:20Z')).toBe('May 22, 2026')
  })

  test('zero-pads the day and uses UTC', () => {
    expect(formatShortDate('2026-01-05T23:59:59Z')).toBe('Jan 05, 2026')
  })

  test('accepts a Date instance', () => {
    expect(formatShortDate(new Date('2025-12-15T12:00:00Z'))).toBe('Dec 15, 2025')
  })

  test('returns an empty string for an unparseable value', () => {
    expect(formatShortDate('not-a-date')).toBe('')
  })
})

describe('extractSubdomain', () => {
  test('extracts the first label from a myshopify.com host', () => {
    expect(extractSubdomain('https://my-shop.myshopify.com')).toBe('my-shop')
  })

  test('extracts the first label from non-myshopify hosts', () => {
    expect(extractSubdomain('my-shop.my.shop.dev')).toBe('my-shop')
    expect(extractSubdomain('https://acme.shop.dev/admin')).toBe('acme')
  })

  test('extracts the first label from a bare host with a port', () => {
    expect(extractSubdomain('my-shop.shop.dev:9292/admin')).toBe('my-shop')
  })

  test('returns undefined for null/undefined input', () => {
    expect(extractSubdomain(null)).toBeUndefined()
    expect(extractSubdomain(undefined)).toBeUndefined()
  })
})
