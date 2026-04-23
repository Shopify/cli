import {executeStoreOperation} from '../../services/store/execute/index.js'
import {openStoreGraphiQL} from '../../services/store/execute/graphiql.js'
import {writeOrOutputStoreExecuteResult} from '../../services/store/execute/result.js'
import StoreCommand from '../../utilities/store-command.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {outputWarn} from '@shopify/cli-kit/node/output'
import {resolvePath} from '@shopify/cli-kit/node/path'
import {Flags} from '@oclif/core'

export default class StoreExecute extends StoreCommand {
  static summary = 'Execute GraphQL queries and mutations on a store, or open an interactive GraphiQL UI.'

  static descriptionWithMarkdown = `Executes an Admin API GraphQL query or mutation on the specified store using previously stored app authentication.

Run \`shopify store auth\` first to create stored auth for the store.

When neither \`--query\` nor \`--query-file\` is provided, opens a local GraphiQL UI in the browser pointed at the store. Use \`--graphiql-port\` to choose the port and \`--no-open\` to keep the browser closed.

Mutations are disabled by default. Re-run with \`--allow-mutations\` if you intend to modify store data; the same flag controls whether the GraphiQL UI is allowed to issue mutations.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --query "query { shop { name } }"',
    `<%= config.bin %> <%= command.id %> --store shop.myshopify.com --query-file ./operation.graphql --variables '{"id":"gid://shopify/Product/1"}'`,
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --query "mutation { shop { id } }" --allow-mutations',
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --query "query { shop { name } }" --json',
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com',
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    query: Flags.string({
      char: 'q',
      description: 'The GraphQL query or mutation, as a string. Omit to open GraphiQL.',
      env: 'SHOPIFY_FLAG_QUERY',
      required: false,
      exclusive: ['query-file'],
    }),
    'query-file': Flags.string({
      description:
        "Path to a file containing the GraphQL query or mutation. Can't be used with --query. Omit to open GraphiQL.",
      env: 'SHOPIFY_FLAG_QUERY_FILE',
      parse: async (input) => resolvePath(input),
      exclusive: ['query'],
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
    'graphiql-port': Flags.integer({
      description: 'Local port for the GraphiQL server when no --query or --query-file is provided.',
      env: 'SHOPIFY_FLAG_GRAPHIQL_PORT',
    }),
    'no-open': Flags.boolean({
      description: 'Do not open the GraphiQL URL in the browser automatically.',
      env: 'SHOPIFY_FLAG_NO_OPEN',
      default: false,
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(StoreExecute)

    if (!flags.query && !flags['query-file']) {
      if (flags['output-file']) {
        outputWarn('--output-file is ignored when opening GraphiQL.')
      }
      if (flags.json) {
        outputWarn('--json is ignored when opening GraphiQL.')
      }

      await openStoreGraphiQL({
        store: flags.store,
        port: flags['graphiql-port'],
        open: !flags['no-open'],
        allowMutations: flags['allow-mutations'],
        query: flags.query,
        variables: flags.variables,
        apiVersion: flags.version,
      })
      return
    }

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
