import {discoverLogs} from '../../../services/logs-discovery.js'
import {logsAccountFlags, logsScopeFlags} from '../../../services/logs-flags.js'
import {logsJsonOutputSchema} from '../../../services/logs-query.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {authAliasFlag, globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {outputResult} from '@shopify/cli-kit/node/output'

export default class LogsTypes extends BaseCommand {
  static baseFlags = {...BaseCommand.baseFlags, ...authAliasFlag}
  static summary = 'List available app log event types.'
  static descriptionWithMarkdown = `Lists event types and their descriptions from the live GraphQL schema. Use these values with \`shopify app logs --type\`.`
  static usage = 'app logs types [flags]'

  static description = this.descriptionForHelp()
  static flags = {...globalFlags, ...jsonFlag, ...logsAccountFlags, ...logsScopeFlags}

  static get jsonOutputSchema() {
    return logsJsonOutputSchema
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(LogsTypes)
    const {output, failed} = await discoverLogs({
      kind: 'types',
      clientId: flags['client-id'] ?? flags.app,
      path: flags.path,
      config: flags.config,
      noPrompt: flags['no-prompt'],
      demo: flags.demo,
      json: flags.json,
    })
    outputResult(output)
    if (failed) process.exitCode = 1
  }
}
