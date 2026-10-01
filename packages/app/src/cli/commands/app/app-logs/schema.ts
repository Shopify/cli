import {fetchLogsSchema} from '../../../services/logs-schema.js'
import {logsAccountFlags, logsScopeFlags} from '../../../services/logs-flags.js'
import {resolveLogsApp} from '../../../services/logs-app.js'
import {logsJsonOutputSchema} from '../../../services/logs-query.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {authAliasFlag, globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {outputResult} from '@shopify/cli-kit/node/output'

export default class LogsSchema extends BaseCommand {
  static baseFlags = {...BaseCommand.baseFlags, ...authAliasFlag}

  static summary = 'Fetch the app logs GraphQL schema.'

  static descriptionWithMarkdown = `Fetches the live GraphQL schema for your app. Uses the current app configuration unless you pass \`--client-id\`. Prints GraphQL SDL with descriptions, field arguments, defaults, enums, and deprecations. Save it to a file and reuse it while composing queries.

Use \`--json\` for the full introspection JSON response. HTTP or GraphQL errors print the JSON response instead of SDL and produce a nonzero exit status.`

  static usage = 'app logs schema [flags]'

  static description = this.descriptionForHelp()

  static examples = [
    '<%= config.bin %> <%= command.id %> > app-logs.graphql',
    '<%= config.bin %> <%= command.id %> --client-id APP_CLIENT_ID --json',
  ]

  static flags = {...globalFlags, ...jsonFlag, ...logsAccountFlags, ...logsScopeFlags}

  static get jsonOutputSchema() {
    return logsJsonOutputSchema
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(LogsSchema)
    const appKey = await resolveLogsApp({
      clientId: flags['client-id'] ?? flags.app,
      path: flags.path,
      config: flags.config,
      noPrompt: flags['no-prompt'],
      demo: flags.demo,
    })
    const {output, failed} = await fetchLogsSchema({
      appKey,
      noPrompt: flags['no-prompt'],
      demo: flags.demo,
      json: flags.json,
    })
    outputResult(output)
    if (failed) process.exitCode = 1
  }
}
