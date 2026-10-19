import {historicalLogFlags} from '../../services/historical-logs/flags.js'
import {retrieveLogs} from '../../services/historical-logs/service.js'
import {renderHistoricalLogs} from '../../services/historical-logs/presenter.js'
import {logsOutput} from '../../services/historical-logs/types.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {authAliasFlag, globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {noInputFlag} from '@shopify/cli-kit/node/no-input'

export default class Logs extends BaseCommand {
  static hidden = true
  static baseFlags = {...BaseCommand.baseFlags, ...authAliasFlag}
  static summary = 'Lists historical app logs.'
  static descriptionWithMarkdown = `Returns a list of historical app logs and exits. Defaults to all supported log types. Use --type to select a type; repeat it to select multiple.

Fast retrieval is the default: leave out --sort. Prefer this mode with a narrow time window and selective filters to consume less throttle capacity. The CLI orders the returned records oldest first, but they aren't necessarily the oldest or newest matches.

Use server-side sorting only when selecting the oldest or newest matching records matters: --sort timestamp selects oldest first; add --order desc for newest first. This sorts before the result limit and is subject to API query limits.

Different filters combine with AND; each accepts one exact value. Type-specific filters exclude records without that field; combining --topic and --operation-name returns no records.

Defaults: preceding hour, 20 records. Maximum: seven-day window within thirty days, 1000 records. Time inputs accept whole seconds only.

--json preserves native record JSON in logs[], including fractional timestamps, diagnostic fields, bodies, and producer truncation flags.`
  static description = this.descriptionForHelp()
  static flags = {...globalFlags, ...jsonFlag, ...noInputFlag, ...historicalLogFlags}
  static examples = [
    '<%= config.bin %> <%= command.id %> --client-id APP_CLIENT_ID --type webhook --topic orders/create --status failure --since 30m',
    '<%= config.bin %> <%= command.id %> --type graphql --operation-name MyQuery --json --no-input',
    '<%= config.bin %> <%= command.id %> --since 1h --sort timestamp --order desc',
  ]

  static get jsonOutputSchema() {
    return logsOutput
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Logs)
    renderHistoricalLogs(await retrieveLogs(flags), flags.json)
  }
}
