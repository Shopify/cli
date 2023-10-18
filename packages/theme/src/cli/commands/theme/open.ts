import {ensureThemeStore} from '../../utilities/theme-store.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {themeFlags} from '../../flags.js'
import {open} from '../../services/open.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'

export default class Open extends ThemeCommand {
  static description = 'Opens the preview of your remote theme.'

  static flags = {
    ...globalFlags,
    password: themeFlags.password,
    development: Flags.boolean({
      char: 'd',
      description: 'Open your development theme.',
      env: 'SHOPIFY_FLAG_DEVELOPMENT',
    }),
    editor: Flags.boolean({
      char: 'E',
      description: 'Open the theme editor for the specified theme in the browser.',
      env: 'SHOPIFY_FLAG_EDITOR',
    }),
    live: Flags.boolean({
      char: 'l',
      description: 'Open your live (published) theme.',
      env: 'SHOPIFY_FLAG_LIVE',
    }),
    theme: Flags.string({
      char: 't',
      description: 'Theme ID or name of the remote theme.',
      env: 'SHOPIFY_FLAG_THEME_ID',
    }),
    store: themeFlags.store,
    environment: themeFlags.environment,
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Open)
    const store = ensureThemeStore(flags)
    const adminSession = await ensureAuthenticatedThemes(store, flags.password)

    await open(adminSession, flags)
  }
}
