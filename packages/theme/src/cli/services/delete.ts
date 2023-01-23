import {findOrSelectTheme, findThemes} from '../utilities/theme-selector.js'
import {Theme} from '../models/theme.js'
import {themeComponent, themesComponent} from '../utilities/theme-ui.js'
import {deleteTheme} from '../utilities/themes-api.js'
import {DevelopmentThemeManager} from '../utilities/development-theme-manager.js'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {renderConfirmationPrompt, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {pluralize} from '@shopify/cli-kit/common/string'
import {store as storage} from '@shopify/cli-kit'

export interface DeleteOptions {
  selectTheme: boolean
  development: boolean
  force: boolean
  themes: string[]
}

export async function deleteThemes(adminSession: AdminSession, options: DeleteOptions) {
  let themeIds = options.themes
  if (options.development) {
    const theme = await new DevelopmentThemeManager(adminSession).find()
    themeIds = [theme.id.toString()]
  }

  const store = adminSession.storeFqdn
  const themes = await findThemesByDeleteOptions(adminSession, {...options, themes: themeIds, development: false})

  if (!options.force && !(await isConfirmed(themes, store))) {
    return
  }

  themes.map((theme) => {
    if (theme.hasDevelopmentRole) {
      storage.removeDevelopmentTheme()
    }
    return deleteTheme(theme.id, adminSession)
  })

  renderSuccess({
    headline: pluralize(
      themes,
      (themes) => [`The following themes were deleted from ${store}:`, themesComponent(themes)],
      (theme) => ['The theme', ...themeComponent(theme), `was deleted from ${store}.`],
    ),
  })
}

async function findThemesByDeleteOptions(adminSession: AdminSession, options: DeleteOptions) {
  const isSingleThemeSelection = options.selectTheme || options.themes.length <= 1

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

  return renderConfirmationPrompt({message, confirmationMessage: 'Yes, confirm changes', cancellationMessage: 'Cancel'})
}

export function renderDeprecatedArgsWarning(argv: string[]) {
  const ids = argv.join(' ')

  renderWarning({
    headline: [
      'Positional arguments are deprecated. Use the',
      {command: '--theme'},
      'flag:',
      {command: `shopify theme delete --theme ${ids}`},
    ],
  })
}
