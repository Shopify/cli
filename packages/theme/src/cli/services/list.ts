import {ThemeListResult} from './list/types.js'
import {Filter, FilterProps, filterThemes} from '../utilities/theme-selector/filter.js'
import {ALLOWED_ROLES, fetchStoreThemes, Role} from '../utilities/theme-selector/fetch.js'
import {AdminSession} from '@shopify/cli-kit/node/session'

interface Options {
  role?: Role
  name?: string
  id?: number
}

export async function list(options: Options, adminSession: AdminSession): Promise<ThemeListResult> {
  const store = adminSession.storeFqdn
  const filter = new Filter({
    ...ALLOWED_ROLES.reduce((roles: FilterProps, role) => {
      roles[role] = options.role === role
      return roles
    }, {}),
    theme: options.id?.toString() ?? options.name,
  })

  let storeThemes = await fetchStoreThemes(adminSession)
  if (filter.any()) {
    storeThemes = filterThemes(store, storeThemes, filter)
  }

  return storeThemes
}
