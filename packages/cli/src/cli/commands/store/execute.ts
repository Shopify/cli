import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import {fileExists, readFile} from '@shopify/cli-kit/node/fs'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {resolvePath} from '@shopify/cli-kit/node/path'
import {Flags} from '@oclif/core'
import {executeStoreOperation} from '../../services/store/execute.js'

interface ExecuteFlags {
  query?: string
  'query-file'?: string
  variables?: string
  'variable-file'?: string
  store: string
  version?: string
  'output-file'?: string
  'allow-mutations': boolean
  mock: boolean
}

export async function readQuery(flags: ExecuteFlags): Promise<string> {
  if (flags.query !== undefined) {
    if (!flags.query.trim()) {
      throw new AbortError('The --query flag value is empty. Please provide a valid GraphQL query or mutation.')
    }

    return flags.query
  }

  if (flags['query-file']) {
    const queryFile = flags['query-file']
    if (!(await fileExists(queryFile))) {
      throw new AbortError(
        outputContent`Query file not found at ${outputToken.path(queryFile)}. Please check the path and try again.`,
      )
    }

    const query = await readFile(queryFile, {encoding: 'utf8'})
    if (!query.trim()) {
      throw new AbortError(
        outputContent`Query file at ${outputToken.path(
          queryFile,
        )} is empty. Please provide a valid GraphQL query or mutation.`,
      )
    }

    return query
  }

  throw new BugError(
    'Query should have been provided via --query or --query-file flags due to exactlyOne constraint. This indicates the oclif flag validation failed.',
  )
}

export default class StoreExecute extends Command {
  static summary = 'Execute GraphQL queries and mutations on a store.'

  static descriptionWithMarkdown = `Executes an Admin API GraphQL query or mutation on the specified store without requiring an app project.

Mutations are disabled by default. Re-run with \`--allow-mutations\` if you intend to modify store data.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --query "query { shop { name } }"',
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --query-file ./operation.graphql --variables "{\"id\":\"gid://shopify/Product/1\"}"',
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --query "mutation { shop { id } }" --allow-mutations',
  ]

  static flags = {
    ...globalFlags,
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
    mock: Flags.boolean({
      char: 'm',
      description: 'Use mock data instead of real API calls (for development).',
      env: 'SHOPIFY_FLAG_MOCK',
      default: false,
      hidden: true,
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(StoreExecute)
    const query = await readQuery(flags as ExecuteFlags)

    await executeStoreOperation({
      store: flags.store,
      query,
      variables: flags.variables,
      variableFile: flags['variable-file'],
      outputFile: flags['output-file'],
      version: flags.version,
      allowMutations: flags['allow-mutations'],
      mock: flags.mock,
    })
  }
}
