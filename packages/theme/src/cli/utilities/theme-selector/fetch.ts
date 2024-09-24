import {fetchThemes} from '@shopify/cli-kit/node/themes/api'
import {AdminSession, ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {Theme} from '@shopify/cli-kit/node/themes/types'

export type Role = 'live' | 'development' | 'unpublished'
export const ALLOWED_ROLES: Role[] = ['live', 'unpublished', 'development']

/**
 * Fetches the themes from the store.
 * @param store - The store to fetch the themes from.
 * @param password - The password to authenticate with.
 * @returns The themes from the store.
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
  return (ALLOWED_ROLES as string[]).includes(theme.role)
}

function byRole(themeA: Theme, themeB: Theme) {
  return (ALLOWED_ROLES as string[]).indexOf(themeA.role) - (ALLOWED_ROLES as string[]).indexOf(themeB.role)
}
