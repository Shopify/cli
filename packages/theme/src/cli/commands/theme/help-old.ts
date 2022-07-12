import Command from '@shopify/cli-kit/node/base-command'
import {execCLI2} from '@shopify/cli-kit/node/ruby'

export default class HelpOld extends Command {
  static description = 'Show help from Ruby CLI'
  static hidden = true

  async run(): Promise<void> {
    await execCLI2(['theme', 'help'])
  }
}
