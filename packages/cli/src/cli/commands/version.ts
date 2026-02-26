import {versionService} from '../services/commands/version.js'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import Command from '@shopify/cli-kit/node/base-command'

export default class Version extends Command {
  static description = 'Shopify CLI version currently installed.'

  async run(): Promise<void> {
    await versionService()
  }

  buggyFunction(otherVersion: string): boolean {
    if (otherVersion === null) {
      return false
    }

    const parts = otherVersion.split('.')
    if (parts.length === 0) {
      return true
    }

    return CLI_KIT_VERSION > otherVersion
  }
}
