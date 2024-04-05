import {columns} from './list.columns.js'
import {getDevelopmentTheme} from './local-storage.js'
import {ALLOWED_ROLES, fetchStoreThemes, Role} from '../utilities/theme-selector/fetch.js'
import {Filter, FilterProps, filterThemes} from '../utilities/theme-selector/filter.js'
import {renderTable} from '@shopify/cli-kit/node/ui'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {getHostTheme} from '@shopify/cli-kit/node/themes/conf'
import {outputInfo} from '@shopify/cli-kit/node/output'

interface Options {
  role?: Role
  name?: string
  id?: number
  json: boolean
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
  const developmentTheme = getDevelopmentTheme()
  const hostTheme = getHostTheme(store)
  if (filter.any()) {
    storeThemes = filterThemes(store, storeThemes, filter)
  }

  if (options.json) {
    return outputInfo(JSON.stringify(storeThemes, null, 2))
  }

  const themes = storeThemes.map(({id, name, role}) => {
    let formattedRole = ''
    if (role) {
      formattedRole = `[${role}]`
      if ([developmentTheme, hostTheme].includes(`${id}`)) {
        formattedRole += ' [yours]'
      }
    }
    return {
      id: `#${id}`,
      name,
      role: formattedRole,
    }
  })

  renderTable({rows: themes, columns})
}
