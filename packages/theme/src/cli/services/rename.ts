import {findOrSelectTheme} from '../utilities/theme-selector.js'
import {themeComponent} from '../utilities/theme-ui.js'
import {updateTheme} from '@shopify/cli-kit/node/themes/api'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

export interface RenameOptions {
  newName: string
  development?: boolean
  theme?: string
  live?: boolean
}

export async function renameTheme(adminSession: AdminSession, options: RenameOptions) {
  const theme = await findOrSelectTheme(adminSession, {
    header: 'Select a theme to open',
    filter: {
      theme: options.theme,
      development: options.development,
      live: options.live,
    },
  })
  await updateTheme(theme.id, {name: options.newName}, adminSession)
  renderSuccess({
    body: ['The theme', ...themeComponent(theme), 'was renamed to', `'${options.newName}'`],
  })
}
