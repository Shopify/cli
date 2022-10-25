import {getThemeStore} from '../../utilities/theme-store.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {themeFlags} from '../../flags.js'
import {Flags} from '@oclif/core'
import {cli, session} from '@shopify/cli-kit'
import {execCLI2} from '@shopify/cli-kit/node/ruby'

export default class Publish extends ThemeCommand {
  static description = 'Set a remote theme as the live theme.'

  static args = [{name: 'themeId', description: 'The ID of the theme', required: false}]

  static flags = {
    ...cli.globalFlags,
    password: themeFlags.password,
    force: Flags.boolean({
      char: 'f',
      description: 'Skip confirmation.',
      env: 'SHOPIFY_FLAG_FORCE',
    }),
    store: themeFlags.store,
  }

  async run(): Promise<void> {
    const {flags, args} = await this.parse(Publish)

    const store = await getThemeStore(flags)
    const flagsToPass = this.passThroughFlags(flags, {exclude: ['path', 'store', 'verbose', 'password']})
    const command = ['theme', 'publish']
    if (args.themeId) {
      command.push(args.themeId)
    }
    command.push(...flagsToPass)

    const adminSession = await session.ensureAuthenticatedThemes(store, flags.password)
    await execCLI2(command, {adminSession})
  }
}
