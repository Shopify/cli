import {historicalLogFlags} from '../../services/historical-logs/flags.js'
import {retrieveLogs} from '../../services/historical-logs/service.js'
import {renderHistoricalLogs} from '../../services/historical-logs/presenter.js'
import {logsOutput} from '../../services/historical-logs/types.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {authAliasFlag, globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {noInputFlag} from '@shopify/cli-kit/node/no-input'

export default class LogsNext extends BaseCommand {
  static hidden = true
  static baseFlags = {...BaseCommand.baseFlags, ...authAliasFlag}
  static summary = 'Retrieve a bounded historical result of app logs.'
  static descriptionWithMarkdown = `Returns a bounded historical result and exits. Use shopify app dev for live Function logs in a development session.

Results are unordered, may be incomplete, and have no pagination. Use --json --no-input for unattended execution. This preview requires an authorized CLI user session.

Defaults: preceding hour, 20 records. Maximum: seven-day window within thirty days, 1000 records. Relative times use the server time from the app scope response before the search.`
  static description = this.descriptionForHelp()
  static flags = {...globalFlags, ...jsonFlag, ...noInputFlag, ...historicalLogFlags}
  static examples = [
    '<%= config.bin %> <%= command.id %> --client-id APP_ID --type webhook --since 30m',
    '<%= config.bin %> <%= command.id %> --type function --json --no-input',
  ]

  static get jsonOutputSchema() {
    return logsOutput
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(LogsNext)
    const result = await retrieveLogs(flags)
    renderHistoricalLogs(result, flags.json)
    if (result.status === 'partial') process.exitCode = 1
  }
}
