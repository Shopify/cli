import {columns} from './list.columns.js'
import {ALLOWED_ROLES, fetchStoreThemes, Role} from '../utilities/theme-selector/fetch.js'
import {Filter, FilterProps, filterThemes} from '../utilities/theme-selector/filter.js'
import {renderTable} from '@shopify/cli-kit/node/ui'
import {AdminSession} from '@shopify/cli-kit/node/session'

export interface Options {
  role?: Role
  name?: string
  id?: number
}

export async function list(adminSession: AdminSession, options: Options) {
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

  const themes = storeThemes.map(({id, name, role}) => ({
    id: `#${id}`,
    name,
    role: role ? `[${role}]` : '',
  }))

  renderTable({rows: themes, columns})
}
