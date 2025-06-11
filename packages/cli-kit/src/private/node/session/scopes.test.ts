import {allDefaultScopes, apiScopes, tokenExchangeScopes} from './scopes.js'
import {describe, expect, test} from 'vitest'

describe('allDefaultScopes', () => {
  // WIP
  test('returns all scopes including custom ones', async () => {
    // Given
    const customScopes = ['custom-scope']

    // When
    const got = allDefaultScopes(customScopes)

    // Then
    expect(got).toEqual([
      'openid',
      'https://api.shopify.com/auth/shop.admin.graphql',
      'https://api.shopify.com/auth/shop.admin.themes',
      'https://api.shopify.com/auth/partners.collaborator-relationships.readonly',
      'https://api.shopify.com/auth/shop.storefront-renderer.devtools',
      'https://api.shopify.com/auth/partners.app.cli.access',
      'https://api.shopify.com/auth/destinations.readonly',
      'https://api.shopify.com/auth/organization.store-management',
      'https://api.shopify.com/auth/organization.apps.manage',
      ...customScopes,
    ])
  })

  test('includes App Management and Store Management', async () => {
    // When
    const got = allDefaultScopes([])

    // Then
    expect(got).toEqual([
      'openid',
      'https://api.shopify.com/auth/shop.admin.graphql',
      'https://api.shopify.com/auth/shop.admin.themes',
      'https://api.shopify.com/auth/partners.collaborator-relationships.readonly',
      'https://api.shopify.com/auth/shop.storefront-renderer.devtools',
      'https://api.shopify.com/auth/partners.app.cli.access',
      'https://api.shopify.com/auth/destinations.readonly',
      'https://api.shopify.com/auth/organization.store-management',
      'https://api.shopify.com/auth/organization.apps.manage',
    ])
  })
})

describe('apiScopes', () => {
  // WIP
  test('returns all scopes for the given API including custom ones', async () => {
    // Given
    const customScopes = ['custom-scope']

    // When
    const got = apiScopes('admin', customScopes)

    // Then
    expect(got).toEqual([
      'https://api.shopify.com/auth/shop.admin.graphql',
      'https://api.shopify.com/auth/shop.admin.themes',
      'https://api.shopify.com/auth/partners.collaborator-relationships.readonly',
      ...customScopes,
    ])
  })
})

describe('tokenExchangeScopes', () => {
  test('returns transformed scopes for partners API', () => {
    // When
    const got = tokenExchangeScopes('partners')

    // Then
    expect(got).toEqual(['https://api.shopify.com/auth/partners.app.cli.access'])
  })

  test('returns transformed scopes for app-management API', () => {
    // When
    const got = tokenExchangeScopes('app-management')

    // Then
    expect(got).toEqual(['https://api.shopify.com/auth/organization.apps.manage'])
  })

  test('returns transformed scopes for business-platform API', () => {
    // When
    const got = tokenExchangeScopes('business-platform')

    // Then
    expect(got).toEqual(['https://api.shopify.com/auth/destinations.readonly'])
  })

  test('throws an error for unsupported APIs', () => {
    // When/Then
    expect(() => tokenExchangeScopes('admin')).toThrow('API not supported for token exchange: admin')
    expect(() => tokenExchangeScopes('storefront-renderer')).toThrow(
      'API not supported for token exchange: storefront-renderer',
    )
  })
})
