import ThemeCommand from '../../utilities/theme-command.js'
import {RenameOptions, renameTheme} from '../../services/rename.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import {themeFlags} from '../../flags.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {promptThemeName} from '@shopify/cli-kit/node/themes/utils'

export default class Rename extends ThemeCommand {
  static summary = 'Renames an existing theme.'

  static descriptionWithMarkdown = `Renames a theme in your store.

  If no theme is specified, then you're prompted to select the theme that you want to rename from the list of themes in your store.
  `

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    store: themeFlags.store,
    password: themeFlags.password,
    environment: themeFlags.environment,
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

  public async run(): Promise<void> {
    const {flags} = await this.parse(Rename)
    const {password, development, name, theme, live} = flags

    const store = ensureThemeStore(flags)
    const adminSession = await ensureAuthenticatedThemes(store, password)
    const newName = name || (await promptThemeName('New name for the theme'))

    const renameOptions: RenameOptions = {
      newName,
      development,
      theme,
      live,
    }

    await renameTheme(adminSession, renameOptions)
  }
}
