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
  const theme = await findOrSelectTheme(adminSession, {
    header: 'Select a theme to open',
    filter: {
      theme: options.theme,
      development: options.development,
    },
  })
  const originalName = theme.name
  await updateTheme(theme.id, {name: options.newName}, adminSession)
  renderSuccess({
    body: `The theme ${originalName} was renamed to ${options.newName}`,
  })
}
