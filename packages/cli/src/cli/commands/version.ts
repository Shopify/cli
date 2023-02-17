import {versionService} from '../services/commands/version.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class Version extends Command {
  static description = 'Shopify CLI version.'

  static flags = {
    ...globalFlags,
  }

  async run(): Promise<void> {
    await versionService()
  }
}
