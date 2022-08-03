import {themeFlags} from '../../flags.js'
import ThemeCommand from '../theme-command.js'
import {cli} from '@shopify/cli-kit'
import {execCLI2} from '@shopify/cli-kit/node/ruby'

export default class Package extends ThemeCommand {
  static description = 'Package your theme into a .zip file, ready to upload to the Online Store.'

  static flags = {
    ...cli.globalFlags,
    ...themeFlags,
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Package)

    await execCLI2(['theme', 'package', flags.path])
  }
}
