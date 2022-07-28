import {getTheme} from '../../utilities/theme-store.js'
import ThemeCommand from '../theme-command.js'
import {Flags} from '@oclif/core'
import {cli, session, string} from '@shopify/cli-kit'
import {execCLI2} from '@shopify/cli-kit/node/ruby'

export default class Publish extends ThemeCommand {
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
    const flagsToPass = this.passThroughFlags(flags, {exclude: ['path', 'store', 'verbose']})
    const command = ['theme', 'publish']
    if (args.themeId) {
      command.push(args.themeId)
    }
    command.push(...flagsToPass)

    const adminSession = await session.ensureAuthenticatedAdmin(store)
    await execCLI2(command, {adminSession})
  }
}
