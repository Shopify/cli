import {getTheme} from '../../utilities/theme-store'
import {Command, Flags} from '@oclif/core'
import {ruby, session, string} from '@shopify/cli-kit'

export default class Open extends Command {
  static description = 'Opens the preview of your remote theme.'

  static flags = {
    development: Flags.boolean({
      char: 'd',
      description: 'Delete your development theme.',
      env: 'SHOPIFY_FLAG_THEME_DEVELOPMENT',
    }),
    live: Flags.boolean({
      char: 'l',
      description: 'Pull theme files from your remote live theme.',
      env: 'SHOPIFY_FLAG_THEME_LIVE',
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
    const store = getTheme(flags)

    const command = ['theme', 'open']
    if (flags.theme) {
      command.push('-t')
      command.push(flags.theme)
    }
    if (flags.development) {
      command.push('-d')
    }
    if (flags.live) {
      command.push('-l')
    }

    const adminSession = await session.ensureAuthenticatedAdmin(store)
    await ruby.execCLI(command, adminSession)
  }
}
