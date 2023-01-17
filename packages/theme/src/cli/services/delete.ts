import {findOrSelectTheme, findThemes} from '../utilities/theme-selector.js'
import {Theme} from '../models/theme.js'
import {themeComponent, themesComponent} from '../utilities/theme-ui.js'
import {deleteTheme} from '../utilities/themes-api.js'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {renderSelectPrompt, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {pluralize} from '@shopify/cli-kit/common/string'

export interface DeleteOptions {
  selectTheme: boolean
  development: boolean
  force: boolean
  themes: string[]
}

export async function deleteThemes(adminSession: AdminSession, options: DeleteOptions) {
  const store = adminSession.storeFqdn
  const themes = await findThemesByDeleteOptions(adminSession, options)

  if (!options.force && !(await isConfirmed(themes, store))) {
    return
  }

  themes.map((theme) => deleteTheme(theme.id, adminSession))

  renderSuccess({
    headline: pluralize(
      themes,
      (themes) => [`The following themes were deleted from ${store}:`, themesComponent(themes)],
      (theme) => ['The theme', ...themeComponent(theme), `was deleted from ${store}`],
    ),
  })
}

async function findThemesByDeleteOptions(adminSession: AdminSession, options: DeleteOptions) {
  const isSingleThemeSelection = options.selectTheme || options.development || options.themes.length <= 1

  if (!isSingleThemeSelection) {
    return findThemes(adminSession, options)
  }

  const store = adminSession.storeFqdn
  const theme = await findOrSelectTheme(adminSession, {
    header: `What theme do you want to delete from ${store}?`,
    filter: {
      ...options,
    },
  })

  return [theme]
}

async function isConfirmed(themes: Theme[], store: string) {
  const message = pluralize(
    themes,
    (themes) => [`Delete the following themes from ${store}?`, themesComponent(themes)],
    (theme) => ['Delete', ...themeComponent(theme), `from ${store}?`],
  )

  return renderSelectPrompt({
    message,
    choices: [
      {
        label: 'Yes, confirm changes',
        value: true,
        key: 'y',
      },
      {
        label: 'Cancel',
        value: false,
        key: 'n',
      },
    ],
  })
}

export function renderDeprecatedArgsWarning(argv: string[]) {
  const ids = argv.join(' ')

  renderWarning({
    headline: [
      'Positional arguments are deprecated. Use the',
      {command: '--theme'},
      'flag:',
      {command: `shopify delete delete --theme ${ids}`},
    ],
  })
}
