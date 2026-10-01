import {discoverLogs} from '../../../services/logs-discovery.js'
import {logsAccountFlags, logsScopeFlags, logsTypeFlag} from '../../../services/logs-flags.js'
import {logsJsonOutputSchema} from '../../../services/logs-query.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {authAliasFlag, globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {outputResult} from '@shopify/cli-kit/node/output'

export default class LogsFilters extends BaseCommand {
  static baseFlags = {...BaseCommand.baseFlags, ...authAliasFlag}
  static summary = 'Explain filters supported by app log event types.'
  static descriptionWithMarkdown = `Lists filter fields, value types, and operators supported by every selected event type. Use these definitions in advanced GraphQL queries. Omit \`--type\` to see filters shared by all event types. No log search is performed.`
  static usage = 'app logs filters [flags]'

  static description = this.descriptionForHelp()
  static flags = {...globalFlags, ...jsonFlag, ...logsAccountFlags, ...logsScopeFlags, type: logsTypeFlag}

  static get jsonOutputSchema() {
    return logsJsonOutputSchema
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(LogsFilters)
    const {output, failed} = await discoverLogs({
      kind: 'filters',
      clientId: flags['client-id'] ?? flags.app,
      path: flags.path,
      config: flags.config,
      types: flags.type,
      noPrompt: flags['no-prompt'],
      demo: flags.demo,
      json: flags.json,
    })
    outputResult(output)
    if (failed) process.exitCode = 1
  }
}
