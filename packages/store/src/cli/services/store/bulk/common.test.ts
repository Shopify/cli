import {formatOperationInfo, validateMutationsAllowed} from './common.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {describe, test, expect} from 'vitest'

describe('formatOperationInfo', () => {
  test('includes the store', () => {
    expect(formatOperationInfo({storeFqdn: 'shop.myshopify.com'})).toEqual(['Store: shop.myshopify.com'])
  })

  test('includes the API version when provided', () => {
    expect(formatOperationInfo({storeFqdn: 'shop.myshopify.com', version: '2026-01'})).toEqual([
      'Store: shop.myshopify.com',
      'API version: 2026-01',
    ])
  })
})

describe('validateMutationsAllowed', () => {
  test('allows queries regardless of the flag', () => {
    expect(() => validateMutationsAllowed('query { shop { name } }', false)).not.toThrow()
  })

  test('throws for a mutation when not allowed', () => {
    expect(() => validateMutationsAllowed('mutation { foo }', false)).toThrow(AbortError)
  })

  test('allows a mutation when explicitly opted in', () => {
    expect(() => validateMutationsAllowed('mutation { foo }', true)).not.toThrow()
  })
})
