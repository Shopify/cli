import {Command, Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {readFile} from '@shopify/cli-kit/node/fs'
import {ensureAuthenticatedAdmin} from '@shopify/cli-kit/node/session'
import {adminRequest} from '@shopify/cli-kit/node/api/admin'

export default class Execute extends Command {
  static summary = 'execute a graphql query or mutation on a store'

  static description = 'executes a graphql query or mutation on the specified store, and writes the result to stdout or a file. supports bulk operations.'

  static flags = {
    ...globalFlags,
    query: Flags.string({
      char: 'q',
      description: 'the graphql query or mutation, as a string',
      exclusive: ['query-file'],
    }),
    'query-file': Flags.string({
      description: 'a file containing the graphql query or mutation',
      exclusive: ['query'],
    }),
    store: Flags.string({
      char: 's',
      description: 'the myshopify.com domain of the store',
    }),
    variables: Flags.string({
      char: 'v',
      description: 'the values for graphql variables, in json format',
      multiple: true,
      exclusive: ['variable-file'],
    }),
    'variable-file': Flags.string({
      description: 'a file containing graphql variables, in jsonl format',
      exclusive: ['variables'],
    }),
    'output-file': Flags.string({
      description: 'the file name where results should be written',
    }),
    'bulk-operation': Flags.boolean({
      description: 'execute as a bulk operation',
      default: false,
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

    let variables: Record<string, unknown> | undefined

    if (flags.variables && flags.variables.length > 0) {
      const variableString = flags.variables[0]
      if (variableString) {
        try {
          variables = JSON.parse(variableString)
        } catch (error) {
          this.error(`invalid json in --variables: ${error}`)
        }
      }
    }

    const adminSession = await ensureAuthenticatedAdmin(store)

    const result = await adminRequest(query, adminSession, variables)

    this.log(JSON.stringify(result, null, 2))
  }
}
