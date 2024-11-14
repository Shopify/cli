import {fetchThemes} from '@shopify/cli-kit/node/themes/api'
import {AdminSession, ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {Theme} from '@shopify/cli-kit/node/themes/types'

export type Role = 'live' | 'development' | 'unpublished'
export const ALLOWED_ROLES: Role[] = ['live', 'unpublished', 'development']

// Export the function type
export type PublicFetchStoreThemes = (store: string, password: string) => Promise<Theme[]>

/**
 * Fetches the themes from the store.
 * @param store - Store URL. It can be the store prefix (example) or the full myshopify.com URL (example.myshopify.com, https://example.myshopify.com).
 * @param password - Password generated from the Theme Access app.
 * @returns An array of themes from the store.
 */
export const publicFetchStoreThemes: PublicFetchStoreThemes = async (store, password) => {
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
  return (ALLOWED_ROLES as string[]).includes(theme.role)
}

function byRole(themeA: Theme, themeB: Theme) {
  return (ALLOWED_ROLES as string[]).indexOf(themeA.role) - (ALLOWED_ROLES as string[]).indexOf(themeB.role)
}
