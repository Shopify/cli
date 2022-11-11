import {themeFlags} from '../../flags.js'
import {getThemeStore} from '../../utilities/theme-store.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {cli, session} from '@shopify/cli-kit'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {Flags} from '@oclif/core'

export default class Share extends ThemeCommand {
  static description =
    'Creates a shareable, unpublished, and new theme on your theme library with a randomized name. Works like an alias to {{command:theme push -u -t=RANDOMIZED_NAME}}'

  static flags = {
    ...cli.globalFlags,
    ...themeFlags,
    force: Flags.boolean({
      hidden: true,
      char: 'f',
      description: 'Proceed without confirmation, if current directory does not seem to be theme directory.',
      env: 'SHOPIFY_FLAG_FORCE',
    }),
  }

  static cli2Flags = ['force']

  async run(): Promise<void> {
    const {flags} = await this.parse(Share)

    const flagsToPass = this.passThroughFlags(flags, {relevantFlags: Share.cli2Flags})
    const command = ['theme', 'push', flags.path, ...flagsToPass]

    const store = await getThemeStore(flags)
    const adminSession = await session.ensureAuthenticatedThemes(store, flags.password)
    await execCLI2(command, {adminSession})
  }
}
