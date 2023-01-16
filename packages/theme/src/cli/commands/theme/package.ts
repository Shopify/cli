import {themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class Package extends ThemeCommand {
  static description = 'Package your theme into a .zip file, ready to upload to the Online Store.'

  static flags = {
    ...globalFlags,
    path: themeFlags.path,
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Package)

    await execCLI2(['theme', 'package', flags.path])
  }
}
