import ThemeCommand from '../../utilities/theme-command.js'
import {RenameOptions, renameTheme} from '../../services/rename.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import {themeFlags} from '../../flags.js'
import {Args, Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'

export default class Rename extends ThemeCommand {
  static description = 'Renames an existing theme.'

  static flags = {
    ...globalFlags,
    store: themeFlags.store,
    password: themeFlags.password,
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
  }

  static args = {
    name: Args.string({
      name: 'name',
      required: true,
      description: 'The new name for the theme.',
    }),
  }

  public async run(): Promise<void> {
    const {flags, args} = await this.parse(Rename)

    const store = ensureThemeStore(flags)
    const adminSession = await ensureAuthenticatedThemes(store, flags.password)

    const renameOptions: RenameOptions = {
      development: flags.development,
      newName: args.name,
    }

    await renameTheme(adminSession, renameOptions)
  }
}
