import {DevelopmentThemeManager} from '../utilities/development-theme-manager.js'
import {findOrSelectTheme} from '../utilities/theme-selector.js'
import {updateTheme} from '@shopify/cli-kit/node/themes/themes-api'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

export interface RenameOptions {
  development: boolean
  newName: string
  theme?: string
}

export async function renameTheme(adminSession: AdminSession, options: RenameOptions) {
  const developmentThemeManager = new DevelopmentThemeManager(adminSession)
  const developmentTheme = (
    await (options.development ? developmentThemeManager.find() : developmentThemeManager.fetch())
  )?.id
  const theme = await findOrSelectTheme(adminSession, {
    header: 'Select a theme to open',
    developmentTheme,
    filter: {
      theme: options.development ? `${developmentTheme}` : options.theme,
    },
  })
  const originalName = theme.name
  await updateTheme(theme.id, {name: options.newName}, adminSession)
  renderSuccess({
    body: `The theme ${originalName} was renamed to ${options.newName}`,
  })
}
