import {executeBulkOperation, prepareBulkOperation} from '../../../services/store/bulk/execute-bulk-operation.js'
import {renderExecuteBulkOperationResult} from '../../../services/store/bulk/execute-result.js'
import {logBulkOperationStart} from '../../../services/store/bulk/progress.js'
import {executeBulkOperationJsonOutputSchema} from '../../../services/store/bulk/types.js'
import StoreCommand from '../../../utilities/store-command.js'
import {bulkOperationFlags, storeFlags} from '../../../flags.js'
import {resolveBulkOperationQuery} from '@shopify/cli-kit/node/api/bulk-operations'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class StoreBulkExecute extends StoreCommand {
  static summary = 'Execute bulk operations on a store.'

  static descriptionWithMarkdown = `Executes an Admin API GraphQL query or mutation on the specified store as a bulk operation, using previously stored app authentication.

  Run \`shopify store auth\` first to create stored auth for the store.

  Bulk operations allow you to process large amounts of data asynchronously. Learn more about [bulk query operations](https://shopify.dev/docs/api/usage/bulk-operations/queries) and [bulk mutation operations](https://shopify.dev/docs/api/usage/bulk-operations/imports).

  Mutations are disabled by default. Re-run with \`--allow-mutations\` if you intend to modify store data.

  Use [\`store bulk status\`](https://shopify.dev/docs/api/shopify-cli/store/store-bulk-status) to check the status of your bulk operations.`

  static description = this.descriptionForHelp()

  static examples = [
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --query "query { products { edges { node { id } } } }"',
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --query-file ./operation.graphql --watch',
    `<%= config.bin %> <%= command.id %> --store shop.myshopify.com --query-file ./mutation.graphql --variable-file ./variables.jsonl --allow-mutations`,
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    store: storeFlags.store,
    ...bulkOperationFlags,
  }

  static get jsonOutputSchema() {
    return executeBulkOperationJsonOutputSchema
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(StoreBulkExecute)

    const query = await resolveBulkOperationQuery({query: flags.query, queryFile: flags['query-file']})

    const input = await prepareBulkOperation({
      store: flags.store,
      query,
      variables: flags.variables,
      variableFile: flags['variable-file'],
      watch: flags.watch ?? false,
      allowMutations: flags['allow-mutations'],
      ...(flags.version && {version: flags.version}),
    })
    const format = flags.json ? 'json' : 'text'
    logBulkOperationStart(
      'Starting bulk operation.',
      {storeFqdn: input.adminSession.storeFqdn, version: input.version},
      format,
    )
    const result = await executeBulkOperation(input)
    await renderExecuteBulkOperationResult(result, {format, watch: input.watch, outputFile: flags['output-file']})
  }
}
