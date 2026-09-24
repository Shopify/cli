import {ThemeRenameResult} from './rename/types.js'
import {findOrSelectTheme} from '../utilities/theme-selector.js'
import {themeUpdate} from '@shopify/cli-kit/node/themes/api'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {promptThemeName} from '@shopify/cli-kit/node/themes/utils'

export interface RenameOptions {
  name?: string
  development?: boolean
  theme?: string
  live?: boolean
}

export async function renameTheme(options: RenameOptions, adminSession: AdminSession): Promise<ThemeRenameResult> {
  const newName = options.name ?? (await promptThemeName('New name for the theme'))

  const theme = await findOrSelectTheme(adminSession, {
    header: 'Select a theme to rename',
    filter: {
      theme: options.theme,
      development: options.development,
      live: options.live,
    },
  })

  // The API helper rejects missing themes and user errors before returning.
  const renamedTheme = (await themeUpdate(theme.id, {name: newName}, adminSession))!
  return {data: {theme: {...renamedTheme, shop: adminSession.storeFqdn}}, originalTheme: theme, requestedName: newName}
}
