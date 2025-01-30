import {getDevelopmentTheme} from './local-storage.js'
import {ALLOWED_ROLES, fetchStoreThemes, Role} from '../utilities/theme-selector/fetch.js'
import {Filter, FilterProps, filterThemes} from '../utilities/theme-selector/filter.js'
import {InlineToken, renderInfo} from '@shopify/cli-kit/node/ui'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {getHostTheme} from '@shopify/cli-kit/node/themes/conf'
import {outputInfo} from '@shopify/cli-kit/node/output'

interface Options {
  role?: Role
  name?: string
  id?: number
  json: boolean
  environment?: string
}

function tabularSection(
  title: string,
  data: InlineToken[][],
): {title: string; body: {tabularData: InlineToken[][]; firstColumnSubdued?: boolean}} {
  return {
    title,
    body: {tabularData: data},
  }
}

export async function list(options: Options, adminSession: AdminSession) {
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
    return [name, formattedRole, `#${id}`]
  })

  const tableData = [
    ['name', 'role', 'id'],
    ['───────────────────────────────', '──────────────────────', '──────────────'],
    ...themes,
  ]

  renderInfo({
    customSections: [
      ...(options.environment
        ? [
            {
              title: `${store} theme library`,
              body: [{subdued: `Environment name: ${options.environment}`}],
            },
          ]
        : []),
      tabularSection('', tableData),
    ],
  })
}
