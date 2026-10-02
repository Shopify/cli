import {versionService} from '../services/commands/version/index.js'
import {presentVersionResult} from '../services/commands/version/result.js'
import {versionJsonOutputSchema} from '../services/commands/version/types.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class Version extends Command {
  static descriptionWithMarkdown = 'Shopify CLI version currently installed.'

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...jsonFlag,
  }

  static get jsonOutputSchema() {
    return versionJsonOutputSchema
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Version)
    const result = await versionService()

    presentVersionResult(result, flags.json ? 'json' : 'text')
  }
}
