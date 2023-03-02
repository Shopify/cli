import {themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {packageTheme} from '../../services/package.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class Package extends ThemeCommand {
  static description = 'Package your theme into a .zip file, ready to upload to the Online Store.'

  static flags = {
    ...globalFlags,
    path: themeFlags.path,
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Package)
    await packageTheme(flags.path)
  }
}
