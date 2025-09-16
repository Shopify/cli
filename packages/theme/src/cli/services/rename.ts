import {findOrSelectTheme} from '../utilities/theme-selector.js'
import {themeComponent} from '../utilities/theme-ui.js'
import {themeUpdate} from '@shopify/cli-kit/node/themes/api'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {promptThemeName} from '@shopify/cli-kit/node/themes/utils'

export interface RenameOptions {
  name?: string
  development?: boolean
  theme?: string
  live?: boolean
  environment?: string
}

export async function renameTheme(options: RenameOptions, adminSession: AdminSession) {
  const newName = options.name || (await promptThemeName('New name for the theme'))

  const theme = await findOrSelectTheme(adminSession, {
    header: 'Select a theme to rename',
    filter: {
      theme: options.theme,
      development: options.development,
      live: options.live,
    },
  })

  await themeUpdate(theme.id, {name: newName}, adminSession)

  renderSuccess({
    body: [
      ...(options.environment ? [{subdued: `Environment: ${options.environment}\n\n`}] : []),
      'The theme',
      ...themeComponent(theme),
      'was renamed to',
      `'${newName}'`,
    ],
  })
}
