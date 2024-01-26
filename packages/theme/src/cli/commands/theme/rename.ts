import ThemeCommand from '../../utilities/theme-command.js'
import {RenameOptions, renameTheme} from '../../services/rename.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import {themeFlags} from '../../flags.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'

export default class Rename extends ThemeCommand {
  static description = 'Renames an existing theme.'

  static flags = {
    ...globalFlags,
    store: themeFlags.store,
    password: themeFlags.password,
    environment: themeFlags.environment,
    name: Flags.string({
      char: 'n',
      description: 'The new name for the theme.',
      env: 'SHOPIFY_FLAG_NEW_NAME',
      required: true,
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

    const renameOptions: RenameOptions = {
      newName: name,
      development,
      theme,
      live,
    }

    await renameTheme(adminSession, renameOptions)
  }
}
