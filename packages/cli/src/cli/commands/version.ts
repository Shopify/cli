import {versionJsonOutputSchema, versionService} from '../services/commands/version.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {outputResult} from '@shopify/cli-kit/node/output'

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
    const version = await versionService()

    outputResult(flags.json ? versionJsonOutputSchema.encode(version) : version)
  }
}
