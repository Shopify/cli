import {executeAppLogsOperation} from '../../services/dev/execute.js'
import {operationFlags} from '../../flags.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {outputResult} from '@shopify/cli-kit/node/output'
import {Flags} from '@oclif/core'

export default class Execute extends BaseCommand {
  static hidden = true
  static summary = 'Prototype only: execute a GraphQL request against the local App Logs API.'
  static description =
    'Prints the complete GraphQL JSON response. The query selects apps, filters, and returned fields. ' +
    'GraphQL or HTTP errors produce a nonzero exit status, preserving partial data when available.'

  static flags = {
    ...globalFlags,
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
    demo: Flags.boolean({
      default: false,
      env: 'SHOPIFY_FLAG_DEMO',
      description: 'Use the loopback demo with seeded auth, not Identity login.',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(Execute)
    const {response, failed} = await executeAppLogsOperation({
      query: flags.query,
      queryFile: flags['query-file'],
      variables: flags.variables,
      variableFile: flags['variable-file'],
      operationName: flags['operation-name'],
      demo: flags.demo,
    })
    outputResult(JSON.stringify(response, null, 2))
    if (failed) process.exitCode = 1
  }
}
