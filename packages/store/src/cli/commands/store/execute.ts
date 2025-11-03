import {Command, Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'

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
  }
}
