import {themeListJsonOutputSchema, type ThemeListResult} from './types.js'
import {getDevelopmentTheme} from '../local-storage.js'
import {getHostTheme} from '@shopify/cli-kit/node/themes/conf'
import {InlineToken, renderInfo} from '@shopify/cli-kit/node/ui'
import {outputResult} from '@shopify/cli-kit/node/output'

function tabularSection(
  title: string,
  data: InlineToken[][],
): {title: string; body: {tabularData: InlineToken[][]; firstColumnSubdued?: boolean}} {
  return {
    title,
    body: {tabularData: data},
  }
}

export function renderThemeListResult(
  result: ThemeListResult,
  format: 'text' | 'json',
  options: {store: string; environment?: string | string[]},
): void {
  if (format === 'json') {
    outputResult(themeListJsonOutputSchema.encode(result))
    return
  }
  const developmentTheme = getDevelopmentTheme()
  const hostTheme = getHostTheme(options.store)
  const themes = result.map(({id, name, role}) => {
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

  renderInfo({
    customSections: [
      ...(options.environment
        ? [
            {
              title: `${options.store} theme library`,
              body: [{subdued: `Environment name: ${options.environment}`}],
            },
          ]
        : []),
      tabularSection('', tableData),
    ],
  })
}
