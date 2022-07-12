import Command from '@shopify/cli-kit/node/base-command'
import {execCLI2} from '@shopify/cli-kit/node/ruby'

export default class Check extends Command {
  static description = 'Validate the theme'

  async run(): Promise<void> {
    await execCLI2(['theme', 'check'])
  }
}
