import {themeFlags} from '../../flags.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'

export default class Share extends ThemeCommand {
  static description =
    'Creates a shareable, unpublished, and new theme on your theme library with a randomized name. Works like an alias to `shopify theme push -u -t=RANDOMIZED_NAME`.'

  static flags = {
    ...globalFlags,
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
    const flagsToPass = this.passThroughFlags(flags, {allowedFlags: Share.cli2Flags})

    const store = ensureThemeStore(flags)
    const adminSession = await ensureAuthenticatedThemes(store, flags.password)

    await execCLI2(['theme', 'share', flags.path, ...flagsToPass], {store, adminToken: adminSession.token})
  }
}
