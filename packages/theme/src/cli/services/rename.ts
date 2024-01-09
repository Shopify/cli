import {DevelopmentThemeManager} from '../utilities/development-theme-manager.js'
import {updateTheme} from '@shopify/cli-kit/node/themes/themes-api'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

export interface RenameOptions {
  development: boolean
  newName: string
}

export async function renameTheme(adminSession: AdminSession, options: RenameOptions) {
  if (options.development) {
    const theme = await new DevelopmentThemeManager(adminSession).find()
    const originalName = theme.name
    await updateTheme(theme.id, {name: options.newName}, adminSession)
    renderSuccess({
      body: `The theme ${originalName} was renamed to ${options.newName}`,
    })
  }
}
