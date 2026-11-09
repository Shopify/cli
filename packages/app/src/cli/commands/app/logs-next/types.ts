import {discoverLogTypes, logTypesJsonOutputSchema} from '../../../services/historical-logs/type-discovery.js'
import {renderLogTypes} from '../../../services/historical-logs/type-discovery-presentation.js'
import {Args} from '@oclif/core'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {outputResult} from '@shopify/cli-kit/node/output'

export default class LogTypes extends BaseCommand {
  static hidden = true
  static summary = 'Lists supported historical app log types.'
  static jsonOutputSchema = logTypesJsonOutputSchema
  static descriptionWithMarkdown =
    'Lists the local catalog of historical app log types, applicable filters, limitations, and examples for app logs-next. Optionally select one type. Does not authenticate, select an app, or check access or log availability.'

  static description = this.descriptionForHelp()
  static flags = {...globalFlags, ...jsonFlag}
  static args = {
    type: Args.string({description: 'The log type to describe. Omit to list all supported types.'}),
  }

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> webhook --json --no-input',
    '<%= config.bin %> <%= command.id %> graphql',
  ]

  async run(): Promise<void> {
    const {args, flags} = await this.parse(LogTypes)
    const result = discoverLogTypes(args.type)
    if (flags.json) {
      outputResult(logTypesJsonOutputSchema.encode(result))
    } else {
      renderLogTypes(result, args.type !== undefined)
    }
  }
}
