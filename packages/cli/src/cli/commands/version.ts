import {versionService} from '../services/commands/version.js'
import Command from '@shopify/cli-kit/node/base-command'

export default class Version extends Command {
  static description = 'Display the Shopify CLI version.'

  async run(): Promise<void> {
    await versionService()
  }
}
