import {executeLogsQuery, logsJsonOutputSchema} from '../services/logs-query.js'
import {operationFlags} from '../flags.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {authAliasFlag, globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {outputResult} from '@shopify/cli-kit/node/output'
import {Flags} from '@oclif/core'

export default class Logs extends BaseCommand {
  static baseFlags = {...BaseCommand.baseFlags, ...authAliasFlag}

  static summary = 'Query app logs using GraphQL (prototype).'

  static descriptionWithMarkdown = `Runs an explicit GraphQL request using your Shopify account. Provide query text or a query file, with optional JSON variables. App scope, filters, fields, sorting, and pagination are specified in the query; no app project is required.

This prototype implements GraphQL mode only. It does not stream logs or accept convenience filter flags. Existing \`shopify app logs\` behavior is unchanged.

Always prints the complete GraphQL JSON response, including errors, partial data, and extensions. \`--json\` is accepted but optional. HTTP or GraphQL errors produce a nonzero exit status. Introspection is supported; schema descriptions explain available fields and query limits.

Local development only: set SHOPIFY_APP_LOG_QUERY_PROTOTYPE=1 and SHOPIFY_SERVICE_ENV=local.`

  static description = this.descriptionForHelp()

  static examples = [
    '<%= config.bin %> <%= command.id %> --query "{ __typename }"',
    `<%= config.bin %> <%= command.id %> --query-file ./logs.graphql --variable-file ./variables.json --json`,
    '<%= config.bin %> <%= command.id %> --query-file - --operation-name Logs',
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    query: operationFlags.query,
    'query-file': Flags.string({
      description: 'Path to a GraphQL document, or - to read from stdin.',
      env: 'SHOPIFY_FLAG_QUERY_FILE',
      exactlyOne: ['query', 'query-file'],
    }),
    variables: operationFlags.variables,
    'variable-file': operationFlags['variable-file'],
    'operation-name': Flags.string({
      description: 'The operation to execute when the document contains multiple operations.',
      env: 'SHOPIFY_FLAG_OPERATION_NAME',
    }),
    'no-prompt': Flags.boolean({
      description: 'Fail instead of prompting for authentication when no valid session is available.',
      env: 'SHOPIFY_FLAG_NO_PROMPT',
      default: false,
    }),
    demo: Flags.boolean({
      env: 'SHOPIFY_FLAG_DEMO',
      hidden: true,
      default: false,
      description: 'Use the loopback development server with local account authentication.',
    }),
  }

  static get jsonOutputSchema() {
    return logsJsonOutputSchema
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Logs)
    const {response, failed} = await executeLogsQuery({
      query: flags.query,
      queryFile: flags['query-file'],
      variables: flags.variables,
      variableFile: flags['variable-file'],
      operationName: flags['operation-name'],
      noPrompt: flags['no-prompt'],
      demo: flags.demo,
    })
    outputResult(logsJsonOutputSchema.encode(response))
    if (failed) process.exitCode = 1
  }
}
