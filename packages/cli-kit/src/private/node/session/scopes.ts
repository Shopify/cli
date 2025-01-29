import {allAPIs, API} from '../api.js'
import {BugError} from '../../../public/node/error.js'

/**
 * Generate a flat array with all the default scopes for all the APIs plus
 * any custom scope defined by the user.
 * @param extraScopes - custom user-defined scopes
 * @returns Array of scopes
 */
export function allDefaultScopes(extraScopes: string[] = []): string[] {
  let scopes = allAPIs.map((api) => defaultApiScopes(api)).flat()
  scopes = ['openid', ...scopes, ...extraScopes].map(scopeTransform)
  return Array.from(new Set(scopes))
}

/**
 * Generate a flat array with the default scopes for the given API plus
 * any custom scope defined by the user
 * @param api - API to get the scopes for
 * @param extraScopes - custom user-defined scopes
 * @returns Array of scopes
 */
export function apiScopes(api: API, extraScopes: string[] = []): string[] {
  const scopes = [...defaultApiScopes(api), ...extraScopes.map(scopeTransform)].map(scopeTransform)
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
    case 'business-platform':
      return ['destinations', 'store-management']
    case 'app-management':
      return ['app-management']
    default:
      throw new BugError(`Unknown API: ${api}`)
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
    case 'destinations':
      return 'https://api.shopify.com/auth/destinations.readonly'
    case 'store-management':
      return 'https://api.shopify.com/auth/organization.store-management'
    case 'app-management':
      return 'https://api.shopify.com/auth/organization.apps.manage'
    default:
      return scope
  }
}
