import {themeFlags} from '../../flags.js'
import {getThemeStore} from '../../utilities/theme-store.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {cli, session} from '@shopify/cli-kit'
import {execCLI2} from '@shopify/cli-kit/node/ruby'

export default class Share extends ThemeCommand {
  static description =
    'Creates a shareable, unpublished, and new theme on your theme library with a randomized name. Works like an alias to {{command:theme push -u -t=RANDOMIZED_NAME}}'

  static flags = {
    ...cli.globalFlags,
    ...themeFlags,
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Share)
    const store = await getThemeStore(flags)
    const adminSession = await session.ensureAuthenticatedThemes(store, flags.password)
    await execCLI2(['theme', 'share', flags.path], {adminSession})
  }
}
