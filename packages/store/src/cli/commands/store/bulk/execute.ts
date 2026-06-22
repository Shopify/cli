import {executeBulkOperation} from '../../../services/store/bulk/execute-bulk-operation.js'
import StoreCommand from '../../../utilities/store-command.js'
import {bulkOperationFlags, storeFlags} from '../../../flags.js'
import {validateSingleOperation} from '@shopify/cli-kit/node/api/bulk-operations'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import {fileExists, readFile} from '@shopify/cli-kit/node/fs'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'

export default class StoreBulkExecute extends StoreCommand {
  static summary = 'Execute bulk operations on a store.'

  static descriptionWithMarkdown = `Executes an Admin API GraphQL query or mutation on the specified store as a bulk operation, using previously stored app authentication.

  Run \`shopify store auth\` first to create stored auth for the store.

  Bulk operations allow you to process large amounts of data asynchronously. Learn more about [bulk query operations](https://shopify.dev/docs/api/usage/bulk-operations/queries) and [bulk mutation operations](https://shopify.dev/docs/api/usage/bulk-operations/imports).

  Mutations are disabled by default. Re-run with \`--allow-mutations\` if you intend to modify store data.

  Use [\`store bulk status\`](https://shopify.dev/docs/api/shopify-cli/store/store-bulk-status) to check the status of your bulk operations.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --query "query { products { edges { node { id } } } }"',
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --query-file ./operation.graphql --watch',
    `<%= config.bin %> <%= command.id %> --store shop.myshopify.com --query-file ./mutation.graphql --variable-file ./variables.jsonl --allow-mutations`,
  ]

  static flags = {
    ...globalFlags,
    store: storeFlags.store,
    ...bulkOperationFlags,
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(StoreBulkExecute)

    const query = await resolveQuery(flags.query, flags['query-file'])
    validateSingleOperation(query)

    await executeBulkOperation({
      store: flags.store,
      query,
      variables: flags.variables,
      variableFile: flags['variable-file'],
      watch: flags.watch ?? false,
      outputFile: flags['output-file'],
      allowMutations: flags['allow-mutations'],
      ...(flags.version && {version: flags.version}),
    })
  }
}

async function resolveQuery(query?: string, queryFile?: string): Promise<string> {
  if (query !== undefined) {
    if (!query.trim()) {
      throw new AbortError('The --query flag value is empty. Please provide a valid GraphQL query or mutation.')
    }
    return query
  }

  if (queryFile) {
    if (!(await fileExists(queryFile))) {
      throw new AbortError(
        outputContent`Query file not found at ${outputToken.path(queryFile)}. Please check the path and try again.`,
      )
    }
    const fileContents = await readFile(queryFile, {encoding: 'utf8'})
    if (!fileContents.trim()) {
      throw new AbortError(
        outputContent`Query file at ${outputToken.path(
          queryFile,
        )} is empty. Please provide a valid GraphQL query or mutation.`,
      )
    }
    return fileContents
  }

  throw new BugError(
    'Query should have been provided via --query or --query-file flags due to exactlyOne constraint. This indicates the oclif flag validation failed.',
  )
}
