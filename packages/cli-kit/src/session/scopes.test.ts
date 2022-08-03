import {allDefaultScopes, apiScopes} from './scopes.js'
import {describe, expect, it} from 'vitest'

describe('allDefaultScopes', () => {
  // WIP
  it('returns all scopes including custom ones', async () => {
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
      ...customScopes,
    ])
  })
})

describe('apiScopes', () => {
  // WIP
  it('returns all scopes for the given API including custom ones', async () => {
    // Given
    const customScopes = ['custom-scope']

    // When
    const got = apiScopes('admin', customScopes)

    // Then
    expect(got).toEqual([
      'openid',
      'https://api.shopify.com/auth/shop.admin.graphql',
      'https://api.shopify.com/auth/shop.admin.themes',
      'https://api.shopify.com/auth/partners.collaborator-relationships.readonly',
      ...customScopes,
    ])
  })
})
