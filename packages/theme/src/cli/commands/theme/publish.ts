import {getTheme} from '../../utilities/theme-store.js'
import {Command, Flags} from '@oclif/core'
import {ruby, session, string} from '@shopify/cli-kit'

export default class Publish extends Command {
  static description = 'Set a remote theme as the live theme.'

  static args = [{name: 'themeId', description: 'The ID of the theme', required: false}]

  static flags = {
    force: Flags.boolean({
      char: 'f',
      description: 'Skip confirmation.',
      env: 'SHOPIFY_FLAG_THEME_FORCE',
    }),
    store: Flags.string({
      char: 's',
      description: 'Store URL',
      env: 'SHOPIFY_FLAG_STORE',
      parse: (input, _) => Promise.resolve(string.normalizeStoreName(input)),
    }),
  }

  async run(): Promise<void> {
    const {flags, args} = await this.parse(Publish)

    const store = getTheme(flags)

    const command = ['theme', 'publish']
    if (args.themeId) {
      command.push(args.themeId)
    }
    if (flags.force) {
      command.push('-f')
    }

    const adminSession = await session.ensureAuthenticatedAdmin(store)
    await ruby.execCLI(command, adminSession)
  }
}
