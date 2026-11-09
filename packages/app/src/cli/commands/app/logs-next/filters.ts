import {discoverLogFilters, logFiltersJsonOutputSchema} from '../../../services/historical-logs/filter-discovery.js'
import {renderLogFilters} from '../../../services/historical-logs/filter-discovery-presentation.js'
import {historicalLogFlags} from '../../../services/historical-logs/flags.js'
import {Flags} from '@oclif/core'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {outputResult} from '@shopify/cli-kit/node/output'

export default class LogFilters extends BaseCommand {
  static hidden = true
  static summary = 'Lists supported historical app log filters and query controls.'
  static jsonOutputSchema = logFiltersJsonOutputSchema
  static descriptionWithMarkdown =
    'Lists local record filters and query/output controls for app logs-next. Without --type, lists all supported inputs and their applicability. Repeat --type to list inputs common to every selected type. Does not authenticate, select an app, or check access or log availability.'

  static description = this.descriptionForHelp()
  static flags = {
    ...globalFlags,
    ...jsonFlag,
    type: Flags.string({
      description: 'Show inputs applicable to this log type; repeat to show inputs common to every selected type.',
      options: historicalLogFlags.type.options,
      multiple: true,
      multipleNonGreedy: true,
      env: 'SHOPIFY_FLAG_TYPE',
    }),
  }

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --type webhook --json --no-input',
    '<%= config.bin %> <%= command.id %> --type graphql --type webhook --json',
  ]

  async run(): Promise<void> {
    const {flags} = await this.parse(LogFilters)
    const result = discoverLogFilters(flags.type)
    if (flags.json) {
      outputResult(logFiltersJsonOutputSchema.encode(result))
    } else {
      renderLogFilters(result)
    }
  }
}
