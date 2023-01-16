import {getThemeStore} from '../../utilities/theme-store.js'
import {themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class List extends ThemeCommand {
  static description = 'Lists your remote themes.'

  static flags = {
    ...globalFlags,
    password: themeFlags.password,
    store: themeFlags.store,
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(List)
    const store = await getThemeStore(flags)
    const adminSession = await ensureAuthenticatedThemes(store, flags.password)
    await execCLI2(['theme', 'list'], {adminSession})
  }
}
