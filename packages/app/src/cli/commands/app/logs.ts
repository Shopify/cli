import {executeLogsQuery, logsJsonOutputSchema} from '../../services/logs-query.js'
import {searchLogs} from '../../services/logs-search.js'
import {logsAccountFlags, logsScopeFlags, logsTypeFlag} from '../../services/logs-flags.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {authAliasFlag, globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {resolvePath} from '@shopify/cli-kit/node/path'
import {outputResult} from '@shopify/cli-kit/node/output'
import {Flags} from '@oclif/core'

const filterFlags = [
  'client-id',
  'app',
  'path',
  'config',
  'type',
  'since',
  'until',
  'limit',
  'shop',
  'status-code',
  'sort',
  'offset',
]

export default class Logs extends BaseCommand {
  static baseFlags = {...BaseCommand.baseFlags, ...authAliasFlag}

  static summary = 'Query historical logs for your Shopify app.'

  static usage = [
    'app logs [--client-id <id>] [--type <type>] [--since <time>] [--limit <n>] [flags]',
    'app logs (--query <query> | --query-file <path>) [flags]',
  ]

  static descriptionWithMarkdown = `Searches app logs using common filters or an explicit GraphQL query. Uses the current app configuration unless you pass \`--client-id\` (alias \`--app\`). Defaults to the last hour and up to 50 events across all supported event types.

Use \`--type\`, \`--since\`, \`--until\`, \`--shop\`, and \`--limit\` for common searches. Use \`--status-code\` with \`--type WEBHOOK_DELIVERY\`. Run \`shopify app logs types\` and \`shopify app logs filters\` to discover event types and supported filters.

For advanced requests, use \`--query\` or \`--query-file\` with optional JSON variables. Specify the app and filters in the GraphQL document; query mode can’t be combined with app selection or filter flags. Run \`shopify app logs schema\` to fetch the live GraphQL schema.

Always prints JSON, including errors, partial data, and query metadata. \`--json\` is optional. HTTP or GraphQL errors produce a nonzero exit status. Results are unordered unless \`--sort\` is specified. A reached limit does not guarantee another page or complete coverage; narrow the search when possible. Nonzero \`--offset\` requires sorting. This command retrieves historical logs; it doesn’t stream.`

  static description = this.descriptionForHelp()

  static examples = [
    '<%= config.bin %> <%= command.id %> --since 1h --limit 50 --json',
    '<%= config.bin %> <%= command.id %> --client-id APP_CLIENT_ID --type WEBHOOK_DELIVERY --status-code 500 --since 15m',
    '<%= config.bin %> <%= command.id %> --query-file ./logs.graphql --variable-file ./variables.json',
    '<%= config.bin %> <%= command.id %> --query-file - --operation-name Logs',
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    ...logsAccountFlags,
    ...logsScopeFlags,
    type: logsTypeFlag,
    since: Flags.string({
      env: 'SHOPIFY_FLAG_SINCE',
      description: 'Start time: a duration such as 15m or 1h, or an ISO 8601 timestamp. Defaults to 1h ago.',
    }),
    until: Flags.string({
      env: 'SHOPIFY_FLAG_UNTIL',
      description: 'End time as an ISO 8601 timestamp. Defaults to now.',
    }),
    limit: Flags.integer({
      env: 'SHOPIFY_FLAG_LIMIT',
      description: 'Maximum number of events (1–1000). Defaults to 50.',
      min: 1,
      max: 1000,
    }),
    shop: Flags.string({
      env: 'SHOPIFY_FLAG_SHOP',
      description: 'Filter by the permanent myshopify.com domain.',
    }),
    'status-code': Flags.string({
      env: 'SHOPIFY_FLAG_STATUS_CODE',
      description: 'Webhook response status code. Requires --type WEBHOOK_DELIVERY.',
    }),
    sort: Flags.string({
      env: 'SHOPIFY_FLAG_SORT',
      description: 'Order results. Omit for a faster, unordered search.',
      options: ['TIMESTAMP_ASC', 'TIMESTAMP_DESC', 'RECORD_ID_ASC', 'RECORD_ID_DESC'],
    }),
    offset: Flags.integer({
      env: 'SHOPIFY_FLAG_OFFSET',
      description: 'Rows to skip in a sorted search (0–100000).',
      min: 0,
      max: 100000,
      dependsOn: ['sort'],
    }),
    query: Flags.string({
      char: 'q',
      description: 'The GraphQL query, as a string. Can’t be combined with filter flags.',
      env: 'SHOPIFY_FLAG_QUERY',
      exclusive: ['query-file', ...filterFlags],
    }),
    'query-file': Flags.string({
      description: 'Path to a GraphQL document, or - to read from stdin. Can’t be combined with filter flags.',
      env: 'SHOPIFY_FLAG_QUERY_FILE',
      exclusive: ['query', ...filterFlags],
    }),
    variables: Flags.string({
      char: 'v',
      description: 'GraphQL variables as a JSON object.',
      exclusive: ['variable-file'],
      env: 'SHOPIFY_FLAG_VARIABLES',
      relationships: [{type: 'some', flags: ['query', 'query-file']}],
    }),
    'variable-file': Flags.string({
      description: 'Path to a JSON file containing GraphQL variables.',
      exclusive: ['variables'],
      parse: async (input) => resolvePath(input),
      env: 'SHOPIFY_FLAG_VARIABLE_FILE',
      relationships: [{type: 'some', flags: ['query', 'query-file']}],
    }),
    'operation-name': Flags.string({
      description: 'The operation to execute when the document contains multiple operations.',
      env: 'SHOPIFY_FLAG_OPERATION_NAME',
      relationships: [{type: 'some', flags: ['query', 'query-file']}],
    }),
  }

  static get jsonOutputSchema() {
    return logsJsonOutputSchema
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Logs)
    const explicitQuery = flags.query !== undefined || flags['query-file'] !== undefined
    const account = {noPrompt: flags['no-prompt'], demo: flags.demo}
    const {response, failed} = explicitQuery
      ? await executeLogsQuery({
          ...account,
          query: flags.query,
          queryFile: flags['query-file'],
          variables: flags.variables,
          variableFile: flags['variable-file'],
          operationName: flags['operation-name'],
        })
      : await searchLogs({
          ...account,
          clientId: flags['client-id'] ?? flags.app,
          path: flags.path,
          config: flags.config,
          types: flags.type,
          since: flags.since,
          until: flags.until,
          limit: flags.limit,
          shop: flags.shop,
          statusCode: flags['status-code'],
          sort: flags.sort,
          offset: flags.offset,
        })
    outputResult(logsJsonOutputSchema.encode(response))
    if (failed) process.exitCode = 1
  }
}
