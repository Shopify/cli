import {mergeRequestedAndStoredScopes, parseStoreAuthScopes, resolveGrantedScopes} from './scopes.js'
import {describe, expect, test} from 'vitest'

describe('store auth scope helpers', () => {
  test('parseStoreAuthScopes splits and deduplicates scopes', () => {
    expect(parseStoreAuthScopes('read_products, write_products,read_products')).toEqual([
      'read_products',
      'write_products',
    ])
  })

  test('mergeRequestedAndStoredScopes avoids redundant reads already implied by existing writes', () => {
    expect(mergeRequestedAndStoredScopes(['read_products'], ['write_products'])).toEqual(['write_products'])
  })

  test('mergeRequestedAndStoredScopes adds newly requested scopes', () => {
    expect(mergeRequestedAndStoredScopes(['read_products'], ['read_orders'])).toEqual(['read_orders', 'read_products'])
  })

  test('parseStoreAuthScopes splits space-separated scopes', () => {
    expect(parseStoreAuthScopes('read_products read_inventory')).toEqual(['read_products', 'read_inventory'])
  })

  test('parseStoreAuthScopes splits mixed comma-and-space delimiters', () => {
    expect(parseStoreAuthScopes('read_products, read_inventory,write_orders')).toEqual([
      'read_products',
      'read_inventory',
      'write_orders',
    ])
  })

  test('resolveGrantedScopes succeeds when granted scopes are space-separated', () => {
    expect(
      resolveGrantedScopes(
        {
          access_token: 'token',
          scope: 'read_products read_inventory',
        },
        ['read_products', 'read_inventory'],
      ),
    ).toEqual(['read_products', 'read_inventory'])
  })

  test('resolveGrantedScopes accepts compressed write scopes that imply requested reads', () => {
    expect(
      resolveGrantedScopes(
        {
          access_token: 'token',
          scope: 'write_products',
        },
        ['read_products', 'write_products'],
      ),
    ).toEqual(['write_products'])
  })

  test('resolveGrantedScopes falls back to requested scopes when Shopify omits scope', () => {
    expect(
      resolveGrantedScopes(
        {
          access_token: 'token',
        },
        ['read_products'],
      ),
    ).toEqual(['read_products'])
  })

  test('resolveGrantedScopes rejects when required scopes are missing', () => {
    expect(() =>
      resolveGrantedScopes(
        {
          access_token: 'token',
          scope: 'read_products',
        },
        ['read_products', 'write_products'],
      ),
    ).toThrow('Shopify granted fewer scopes than were requested.')
  })
})
