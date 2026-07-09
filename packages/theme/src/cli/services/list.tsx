import {getDevelopmentTheme} from './local-storage.js'
import {Filter, FilterProps, filterThemes} from '../utilities/theme-selector/filter.js'
import {ALLOWED_ROLES, fetchStoreThemes, Role} from '../utilities/theme-selector/fetch.js'
import {Panel} from '../ui/components/Panel.js'
import {Cell, StyledTable} from '../ui/components/StyledTable.js'
import {renderThemeView} from '../ui/render.js'
import {palette} from '../ui/palette.js'
import {InlineToken, renderInfo} from '@shopify/cli-kit/node/ui'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {getHostTheme} from '@shopify/cli-kit/node/themes/conf'
import {outputResult} from '@shopify/cli-kit/node/output'
import React from 'react'

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

function roleColor(role: string): string | undefined {
  switch (role) {
    case 'live':
      return palette.role
    case 'development':
      return palette.border
    case 'unpublished':
      return palette.subdued
    default:
      return palette.text
  }
}

function styledRoleCell(role: string, isLive: boolean, isCurrent: boolean): Cell {
  let text = role
  if (isLive) {
    text = `● ${text}`
  }
  if (isCurrent) {
    text += ' (current)'
  }
  return {text, color: roleColor(role), bold: isLive}
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
    return outputResult(JSON.stringify(storeThemes, null, 2))
  }

  const themes = storeThemes.map(({id, name, role}) => {
    let formattedRole = ''
    if (role) {
      formattedRole = `[${role}]`
      if ([developmentTheme, hostTheme].includes(`${id}`)) {
        formattedRole += ' [current]'
      }
    }
    return [name, formattedRole, `#${id}`]
  })

  const tableData = [
    ['name', 'role', 'id'],
    ['───────────────────────────────', '──────────────────────', '──────────────'],
    ...themes,
  ]

  const styledThemes: Cell[][] = storeThemes.map(({id, name, role}) => {
    const isLive = role === 'live'
    const isCurrent = [developmentTheme, hostTheme].includes(`${id}`)
    const nameCell: Cell = isLive ? {text: name, bold: true} : name
    const roleCell: Cell = role ? styledRoleCell(role, isLive, isCurrent) : ''
    const idCell: Cell = {text: `#${id}`, color: palette.subdued}
    return [nameCell, roleCell, idCell]
  })

  await renderThemeView(
    <Panel
      title={`${store} theme library`}
      footer={`${styledThemes.length} ${styledThemes.length === 1 ? 'theme' : 'themes'}`}
    >
      <StyledTable columns={['name', 'role', 'id']} rows={styledThemes} />
    </Panel>,
    () =>
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
      }),
  )
}
