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
  static summary = 'Retrieve a bounded historical result of app logs.'
  static descriptionWithMarkdown = `Returns a bounded historical result and exits.

Defaults to webhook and graphql. Use --type to select a type; repeat it to select multiple. GraphQL covers multiple APIs, not only Admin. Different filters combine with AND; each accepts one exact value. Type-specific filters exclude records without that field; combining --topic and --operation-name returns no records.

Results are unordered, may be incomplete, and have no pagination. The limit does not mean newest N. Defaults: preceding hour, 20 records. Maximum: seven-day window within thirty days, 1000 records. Time inputs accept whole seconds only.

--json preserves native App Logs API record JSON in logs[], including fractional timestamps, diagnostic fields, bodies, and producer truncation flags. Treat saved output as potentially sensitive. --json-schema describes the envelope and common fields, not a deep per-type schema. Use --no-input independently to disable prompts.`
  static description = this.descriptionForHelp()
  static flags = {...globalFlags, ...jsonFlag, ...noInputFlag, ...historicalLogFlags}
  static examples = [
    '<%= config.bin %> <%= command.id %> --client-id APP_CLIENT_ID --type webhook --topic orders/create --status failure --since 30m',
    '<%= config.bin %> <%= command.id %> --type graphql --operation-name MyQuery --json --no-input',
  ]

  static get jsonOutputSchema() {
    return logsOutput
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Logs)
    renderHistoricalLogs(await retrieveLogs(flags), flags.json)
  }
}
