import ThemeCommand, {RequiredFlags} from '../../utilities/theme-command.js'
import {themeFlags} from '../../flags.js'
import {RenameOptions, renameTheme} from '../../services/rename.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {AdminSession} from '@shopify/cli-kit/node/session'

export default class Rename extends ThemeCommand {
  static summary = 'Renames an existing theme.'

  static descriptionWithMarkdown = `Renames a theme in your store.

  If no theme is specified, then you're prompted to select the theme that you want to rename from the list of themes in your store.
  `

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...themeFlags,
    name: Flags.string({
      char: 'n',
      description: 'The new name for the theme.',
      env: 'SHOPIFY_FLAG_NEW_NAME',
      required: false,
    }),
    development: Flags.boolean({
      char: 'd',
      description: 'Rename your development theme.',
      env: 'SHOPIFY_FLAG_DEVELOPMENT',
    }),
    theme: Flags.string({
      char: 't',
      description: 'Theme ID or name of the remote theme.',
      env: 'SHOPIFY_FLAG_THEME_ID',
    }),
    live: Flags.boolean({
      char: 'l',
      description: 'Rename your remote live theme.',
      env: 'SHOPIFY_FLAG_LIVE',
    }),
  }

  static multiEnvironmentsFlags: RequiredFlags = ['store', 'password', 'name', ['live', 'development', 'theme']]

  async command(flags: RenameOptions, adminSession: AdminSession) {
    await renameTheme(flags, adminSession)
  }
}
