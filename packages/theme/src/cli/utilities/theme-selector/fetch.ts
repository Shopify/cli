import {fetchThemes} from '../themes-api.js'
import {Theme} from '../../models/theme.js'
import {error} from '@shopify/cli-kit'
import {AdminSession} from '@shopify/cli-kit/node/session.js'

const ALLOWED_ROLES = ['live', 'unpublished', 'development']

export async function fetchStoreThemes(session: AdminSession) {
  const store = session.storeFqdn
  const themes = (await fetchThemes(session)).filter(isRoleAllowed)

  if (themes.length === 0) {
    throw new error.Abort(`There are no themes in the ${store} store`)
  }

  return themes.sort(byRole)
}

function isRoleAllowed(theme: Theme) {
  return ALLOWED_ROLES.includes(theme.role)
}

function byRole(themeA: Theme, themeB: Theme) {
  return ALLOWED_ROLES.indexOf(themeA.role) - ALLOWED_ROLES.indexOf(themeB.role)
}
