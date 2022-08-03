import {themeFlags} from '../../flags.js'
import {getTheme} from '../../utilities/theme-store.js'
import ThemeCommand from '../theme-command.js'
import {Flags} from '@oclif/core'
import {cli, session, string} from '@shopify/cli-kit'
import {execCLI2} from '@shopify/cli-kit/node/ruby'

export default class Share extends ThemeCommand {
  static description =
    'Creates a shareable, unpublished, and new theme on your theme library with a randomized name. Works like an alias to {{command:theme push -u -t=RANDOMIZED_NAME}}'

  static flags = {
    ...cli.globalFlags,
    ...themeFlags,
    store: Flags.string({
      char: 's',
      description: 'Store URL',
      env: 'SHOPIFY_FLAG_STORE',
      parse: (input, _) => Promise.resolve(string.normalizeStoreName(input)),
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Share)
    const store = getTheme(flags)
    const adminSession = await session.ensureAuthenticatedAdmin(store)
    await execCLI2(['theme', 'share', flags.path], {adminSession})
  }
}
