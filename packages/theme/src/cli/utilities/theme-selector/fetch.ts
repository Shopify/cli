import {fetchThemes} from '@shopify/cli-kit/node/themes/api'
import {AdminSession, ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {Theme} from '@shopify/cli-kit/node/themes/types'

export type Role = 'live' | 'development' | 'unpublished'
export const ALLOWED_ROLES: Role[] = ['live', 'unpublished', 'development']

// O(1) lookup for role membership
const ALLOWED_ROLES_SET = new Set<string>(ALLOWED_ROLES)

// O(1) lookup for role sort order
const ROLE_ORDER = new Map<string, number>(ALLOWED_ROLES.map((role, index) => [role, index]))

/**
 * Fetches the themes from the store.
 * @param store - Store URL. It can be the store prefix (example) or the full myshopify.com URL (example.myshopify.com, https://example.myshopify.com).
 * @param password - Password generated from the Theme Access app.
 * @returns An array of themes from the store.
 */
export async function publicFetchStoreThemes(store: string, password: string) {
  const adminSession = await ensureAuthenticatedThemes(store, password)
  return fetchStoreThemes(adminSession)
}

export async function fetchStoreThemes(session: AdminSession) {
  const store = session.storeFqdn
  const themes = (await fetchThemes(session)).filter(isRoleAllowed)

  if (themes.length === 0) {
    throw new AbortError(`There are no themes in the ${store} store`)
  }

  return themes.sort(byRole)
}

function isRoleAllowed(theme: Theme) {
  return ALLOWED_ROLES_SET.has(theme.role)
}

function byRole(themeA: Theme, themeB: Theme) {
  return (ROLE_ORDER.get(themeA.role) ?? Infinity) - (ROLE_ORDER.get(themeB.role) ?? Infinity)
}
