import {getTheme} from '../../utilities/theme-store.js'
import {Flags} from '@oclif/core'
import {cli, session, string} from '@shopify/cli-kit'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import Command from '@shopify/cli-kit/node/base-command'

export default class Publish extends Command {
  static description = 'Set a remote theme as the live theme.'

  static args = [{name: 'themeId', description: 'The ID of the theme', required: false}]

  static flags = {
    ...cli.globalFlags,
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
    await execCLI2(command, adminSession)
  }
}
