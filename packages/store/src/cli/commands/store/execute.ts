import {parseGraphQLOperation} from '../../services/graphql-parser.js'
import {runBulkQuery} from '../../services/bulk-operations.js'
import {Command, Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {ensureAuthenticatedAdmin} from '@shopify/cli-kit/node/session'
import {adminRequest} from '@shopify/cli-kit/node/api/admin'
import {outputInfo, outputSuccess} from '@shopify/cli-kit/node/output'

export default class Execute extends Command {
  static summary = 'execute a graphql query or mutation on a store'

  static description =
    'executes a graphql query or mutation on the specified store, and writes the result to stdout or a file. supports bulk operations.'

  static flags = {
    ...globalFlags,
    query: Flags.string({
      char: 'q',
      description: 'the graphql query or mutation, as a string',
      exclusive: ['query-file'],
      env: 'SHOPIFY_FLAG_QUERY',
    }),
    'query-file': Flags.string({
      description: 'a file containing the graphql query or mutation',
      exclusive: ['query'],
      env: 'SHOPIFY_FLAG_QUERY_FILE',
    }),
    store: Flags.string({
      char: 's',
      description: 'the myshopify.com domain of the store',
      env: 'SHOPIFY_FLAG_STORE',
    }),
    variables: Flags.string({
      char: 'v',
      description: 'the values for graphql variables, in json format',
      multiple: true,
      exclusive: ['variable-file'],
      env: 'SHOPIFY_FLAG_VARIABLES',
    }),
    'variable-file': Flags.string({
      description: 'a file containing graphql variables, in jsonl format',
      exclusive: ['variables'],
      env: 'SHOPIFY_FLAG_VARIABLE_FILE',
    }),
    'output-file': Flags.string({
      description: 'the file name where results should be written',
      env: 'SHOPIFY_FLAG_OUTPUT_FILE',
    }),
    'bulk-operation': Flags.boolean({
      description: 'execute as a bulk operation',
      default: false,
      env: 'SHOPIFY_FLAG_BULK_OPERATION',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Execute)

    let query = flags.query

    if (!query && flags['query-file']) {
      query = await readFile(flags['query-file'])
    }

    if (!query) {
      this.error('either --query or --query-file is required')
    }

    const store = flags.store
    if (!store) {
      this.error('--store is required')
    }

    const adminSession = await ensureAuthenticatedAdmin(store)

    if (flags['bulk-operation']) {
      const operationType = parseGraphQLOperation(query)

      if (operationType === 'query') {
        const result = await runBulkQuery(query, adminSession, (status, objectCount, rate, spinner) => {
          const rateStr = rate > 0 ? ` • ${Math.round(rate)} obj/sec` : ''
          process.stderr.write(`\r\x1b[K${status.toLowerCase()}: ${objectCount} objects${rateStr} ${spinner}`)
        })

        this.log('\n')

        if (flags['output-file']) {
          await writeFile(flags['output-file'], result.content)
          outputSuccess(`wrote ${result.totalObjects} objects to ${flags['output-file']}`)
          outputInfo(
            `completed in ${result.totalTimeSeconds.toFixed(1)}s (${Math.round(result.averageRate)} obj/sec average)`,
          )
        } else {
          process.stderr.write(
            `completed in ${result.totalTimeSeconds.toFixed(1)}s (${Math.round(
              result.averageRate,
            )} obj/sec average)\n\n`,
          )
          this.log(result.content)
        }
      } else {
        this.error('bulk mutations not yet implemented')
      }
      return
    }

    const result = await adminRequest(query, adminSession)

    this.log(JSON.stringify(result, null, 2))
  }
}
