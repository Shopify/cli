import {allDefaultScopes, apiScopes} from './scopes.js'
import {environmentVariables} from '../constants.js'
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
      ...customScopes,
    ])
  })

  test('includes App Management and Store Management when the required env var is defined', async () => {
    // Given
    const envVars = {[environmentVariables.useAppManagement]: 'true'}

    // When
    const got = allDefaultScopes([], envVars)

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
