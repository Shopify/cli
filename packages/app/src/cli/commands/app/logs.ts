import {executeLogsQuery, logsJsonOutputSchema} from '../../services/logs-query.js'
import {logsAccountFlags} from '../../services/logs-flags.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {authAliasFlag, globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {resolvePath} from '@shopify/cli-kit/node/path'
import {outputResult} from '@shopify/cli-kit/node/output'
import {Flags} from '@oclif/core'

export default class Logs extends BaseCommand {
  static baseFlags = {...BaseCommand.baseFlags, ...authAliasFlag}

  static summary = 'Query historical app logs with GraphQL.'

  static usage = 'app logs (--query <query> | --query-file <path>) [flags]'

  static descriptionWithMarkdown = `Runs a GraphQL query against app logs. Pass the document with \`--query\`, load it with \`--query-file\`, or use \`--query-file -\` to read from stdin. Supply JSON variables with \`--variables\` or \`--variable-file\`.

Specify the app, time range, filters, and selected fields in the GraphQL document or variables. Run \`shopify app logs schema\` to fetch the live GraphQL schema.

Prints the full query response as JSON, including GraphQL errors, partial data, and query metadata. Use \`--json\` to also format CLI errors as JSON. HTTP or GraphQL errors produce a nonzero exit status. This command retrieves historical logs; it doesn’t stream.`

  static description = this.descriptionForHelp()

  static examples = [
    '<%= config.bin %> <%= command.id %> --query \'{ app(key: "APP_CLIENT_ID") { key } }\'',
    '<%= config.bin %> <%= command.id %> --query-file ./logs.graphql --variable-file ./variables.json',
    '<%= config.bin %> <%= command.id %> --query-file - --operation-name Logs',
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    ...logsAccountFlags,
    query: Flags.string({
      char: 'q',
      description: 'The GraphQL query, as a string.',
      env: 'SHOPIFY_FLAG_QUERY',
      exactlyOne: ['query', 'query-file'],
    }),
    'query-file': Flags.string({
      description: 'Path to a GraphQL document, or - to read from stdin.',
      env: 'SHOPIFY_FLAG_QUERY_FILE',
      exactlyOne: ['query', 'query-file'],
    }),
    variables: Flags.string({
      char: 'v',
      description: 'GraphQL variables as a JSON object.',
      exclusive: ['variable-file'],
      env: 'SHOPIFY_FLAG_VARIABLES',
    }),
    'variable-file': Flags.string({
      description: 'Path to a JSON file containing GraphQL variables.',
      exclusive: ['variables'],
      parse: async (input) => resolvePath(input),
      env: 'SHOPIFY_FLAG_VARIABLE_FILE',
    }),
    'operation-name': Flags.string({
      description: 'The operation to execute when the document contains multiple operations.',
      env: 'SHOPIFY_FLAG_OPERATION_NAME',
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
