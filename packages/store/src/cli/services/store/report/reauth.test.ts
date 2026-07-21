import {parseRequiredScopes} from './reauth.js'
import {describe, expect, test} from 'vitest'

describe('parseRequiredScopes', () => {
  test('extracts the scope named in a Shopify access-denied message', () => {
    const scopes = parseRequiredScopes({
      errorText: 'Access denied for shopifyqlQuery field. Required access: `read_reports` access scope.',
      accessDenied: true,
      errors: [],
    })

    expect(scopes).toEqual(['read_reports'])
  })

  test('extracts and de-duplicates multiple scopes', () => {
    const scopes = parseRequiredScopes({
      errorText: 'requires `read_orders`, `read_orders`, and `write_products`',
      accessDenied: true,
      errors: [],
    })

    expect(scopes).toEqual(['read_orders', 'write_products'])
  })

  test('returns nothing when the failure names no scope', () => {
    const scopes = parseRequiredScopes({errorText: 'Internal server error', accessDenied: true, errors: []})

    expect(scopes).toEqual([])
  })
})
