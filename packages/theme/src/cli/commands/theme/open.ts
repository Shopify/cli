import {getTheme} from '../../utilities/theme-store.js'
import ThemeCommand from '../theme-command.js'
import {Flags} from '@oclif/core'
import {cli, session, string} from '@shopify/cli-kit'
import {execCLI2} from '@shopify/cli-kit/node/ruby'

export default class Open extends ThemeCommand {
  static description = 'Opens the preview of your remote theme.'

  static flags = {
    ...cli.globalFlags,
    development: Flags.boolean({
      char: 'd',
      description: 'Delete your development theme.',
      env: 'SHOPIFY_FLAG_DEVELOPMENT',
    }),
    editor: Flags.boolean({
      char: 'e',
      description: 'Open the theme editor for the specified theme in the browser.',
      env: 'SHOPIFY_FLAG_EDITOR',
    }),
    live: Flags.boolean({
      char: 'l',
      description: 'Pull theme files from your remote live theme.',
      env: 'SHOPIFY_FLAG_LIVE',
    }),
    theme: Flags.string({
      char: 't',
      description: 'Theme ID or name of the remote theme.',
      env: 'SHOPIFY_FLAG_THEME_ID',
    }),
    store: Flags.string({
      char: 's',
      description: 'Store URL',
      env: 'SHOPIFY_FLAG_STORE',
      parse: (input, _) => Promise.resolve(string.normalizeStoreName(input)),
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Open)
    const flagsToPass = this.passThroughFlags(flags, {exclude: ['store', 'verbose']})
    const command = ['theme', 'open', ...flagsToPass]

    const store = getTheme(flags)
    const adminSession = await session.ensureAuthenticatedAdmin(store)
    await execCLI2(command, {adminSession})
  }
}
