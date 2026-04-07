import {executeStoreOperation} from '../../services/store/execute/index.js'
import {writeOrOutputStoreExecuteResult} from '../../services/store/execute/result.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {resolvePath} from '@shopify/cli-kit/node/path'
import {Flags} from '@oclif/core'

export default class StoreExecute extends Command {
  static summary = 'Execute GraphQL queries and mutations on a store.'

  static descriptionWithMarkdown = `Executes an Admin API GraphQL query or mutation on the specified store using previously stored app authentication.

Run \`shopify store auth\` first to create stored auth for the store.

Mutations are disabled by default. Re-run with \`--allow-mutations\` if you intend to modify store data.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --query "query { shop { name } }"',
    `<%= config.bin %> <%= command.id %> --store shop.myshopify.com --query-file ./operation.graphql --variables '{"id":"gid://shopify/Product/1"}'`,
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --query "mutation { shop { id } }" --allow-mutations',
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --query "query { shop { name } }" --json',
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    query: Flags.string({
      char: 'q',
      description: 'The GraphQL query or mutation, as a string.',
      env: 'SHOPIFY_FLAG_QUERY',
      required: false,
      exactlyOne: ['query', 'query-file'],
    }),
    'query-file': Flags.string({
      description: "Path to a file containing the GraphQL query or mutation. Can't be used with --query.",
      env: 'SHOPIFY_FLAG_QUERY_FILE',
      parse: async (input) => resolvePath(input),
      exactlyOne: ['query', 'query-file'],
    }),
    variables: Flags.string({
      char: 'v',
      description: 'The values for any GraphQL variables in your query or mutation, in JSON format.',
      env: 'SHOPIFY_FLAG_VARIABLES',
      exclusive: ['variable-file'],
    }),
    'variable-file': Flags.string({
      description: "Path to a file containing GraphQL variables in JSON format. Can't be used with --variables.",
      env: 'SHOPIFY_FLAG_VARIABLE_FILE',
      parse: async (input) => resolvePath(input),
      exclusive: ['variables'],
    }),
    store: Flags.string({
      char: 's',
      description: 'The myshopify.com domain of the store to execute against.',
      env: 'SHOPIFY_FLAG_STORE',
      parse: async (input) => normalizeStoreFqdn(input),
      required: true,
    }),
    version: Flags.string({
      description: 'The API version to use for the query or mutation. Defaults to the latest stable version.',
      env: 'SHOPIFY_FLAG_VERSION',
    }),
    'output-file': Flags.string({
      description: 'The file name where results should be written, instead of STDOUT.',
      env: 'SHOPIFY_FLAG_OUTPUT_FILE',
      parse: async (input) => resolvePath(input),
    }),
    'allow-mutations': Flags.boolean({
      description: 'Allow GraphQL mutations to run against the target store.',
      env: 'SHOPIFY_FLAG_ALLOW_MUTATIONS',
      default: false,
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(StoreExecute)

    const result = await executeStoreOperation({
      store: flags.store,
      query: flags.query,
      queryFile: flags['query-file'],
      variables: flags.variables,
      variableFile: flags['variable-file'],
      version: flags.version,
      allowMutations: flags['allow-mutations'],
    })

    await writeOrOutputStoreExecuteResult(result, flags['output-file'], flags.json ? 'json' : 'text')
  }
}
