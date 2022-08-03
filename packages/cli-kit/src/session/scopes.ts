import {Bug} from '../error.js'
import {allAPIs, API} from '../network/api.js'

/**
 * Generate a flat array with all the default scopes for all the APIs plus
 * any custom scope defined by the user.
 * @param extraScopes custom user-defined scopes
 * @returns Array of scopes
 */
export function allDefaultScopes(extraScopes: string[] = []): string[] {
  let scopes = allAPIs.map(defaultApiScopes).flat()
  scopes = ['openid', ...scopes, ...extraScopes].map(scopeTransform)
  return Array.from(new Set(scopes))
}

/**
 * Generate a flat array with the default scopes for the given API plus
 * any custom scope defined by the user
 * @param api API to get the scopes for
 * @param extraScopes custom user-defined scopes
 * @returns Array of scopes
 */
export function apiScopes(api: API, extraScopes: string[] = []): string[] {
  const scopes = ['openid', ...defaultApiScopes(api), ...extraScopes.map(scopeTransform)].map(scopeTransform)
  return Array.from(new Set(scopes))
}

function defaultApiScopes(api: API): string[] {
  switch (api) {
    case 'admin':
      return ['graphql', 'themes', 'collaborator']
    case 'storefront-renderer':
      return ['devtools']
    case 'partners':
      return ['cli']
    default:
      throw new Bug(`Unknown API: ${api}`)
  }
}

function scopeTransform(scope: string): string {
  switch (scope) {
    case 'graphql':
      return 'https://api.shopify.com/auth/shop.admin.graphql'
    case 'themes':
      return 'https://api.shopify.com/auth/shop.admin.themes'
    case 'collaborator':
      return 'https://api.shopify.com/auth/partners.collaborator-relationships.readonly'
    case 'cli':
      return 'https://api.shopify.com/auth/partners.app.cli.access'
    case 'devtools':
      return 'https://api.shopify.com/auth/shop.storefront-renderer.devtools'
    default:
      return scope
  }
}
