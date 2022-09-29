import {getThemeStore} from '../../utilities/theme-store.js'
import {themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {cli, session} from '@shopify/cli-kit'
import {execCLI2} from '@shopify/cli-kit/node/ruby'

export default class List extends ThemeCommand {
  static description = 'Lists your remote themes.'

  static flags = {
    ...cli.globalFlags,
    password: themeFlags.password,
    store: themeFlags.store,
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(List)
    const store = await getThemeStore(flags)
    const adminSession = await session.ensureAuthenticatedThemes(store, flags.password)
    await execCLI2(['theme', 'list'], {adminSession})
  }
}
