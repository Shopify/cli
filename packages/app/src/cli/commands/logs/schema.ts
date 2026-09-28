import {fetchLogsSchema} from '../../services/logs-schema.js'
import {logsApiFlags} from '../../services/logs-flags.js'
import {logsJsonOutputSchema} from '../../services/logs-query.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {authAliasFlag, globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {outputResult} from '@shopify/cli-kit/node/output'

export default class LogsSchema extends BaseCommand {
  static baseFlags = {...BaseCommand.baseFlags, ...authAliasFlag}

  static summary = 'Fetch the live App Logs API GraphQL schema (prototype).'

  static descriptionWithMarkdown = `Fetches the schema through authenticated introspection using the same API and account as \`shopify logs\`. Prints GraphQL SDL with descriptions, field arguments, defaults, enums, and deprecations. Save it to a file and reuse it while composing queries; no schema is bundled in the CLI.

Use \`--json\` for the full introspection JSON response. HTTP or GraphQL errors print the JSON response instead of SDL and produce a nonzero exit status. Optional variables are forwarded for API authorization context.

Local development only: set SHOPIFY_APP_LOG_QUERY_PROTOTYPE=1 and SHOPIFY_SERVICE_ENV=local.`

  static description = this.descriptionForHelp()

  static examples = [
    '<%= config.bin %> <%= command.id %> --api app-logs > app-logs.graphql',
    '<%= config.bin %> <%= command.id %> --api app-logs --json',
  ]

  static flags = {...globalFlags, ...jsonFlag, ...logsApiFlags}

  static get jsonOutputSchema() {
    return logsJsonOutputSchema
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(LogsSchema)
    const {output, failed} = await fetchLogsSchema({
      api: flags.api,
      variables: flags.variables,
      variableFile: flags['variable-file'],
      noPrompt: flags['no-prompt'],
      demo: flags.demo,
      json: flags.json,
    })
    outputResult(output)
    if (failed) process.exitCode = 1
  }
}
