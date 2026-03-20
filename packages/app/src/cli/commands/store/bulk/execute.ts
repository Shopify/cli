import {storeBulkOperationFlags} from '../../../flags.js'
import {storeExecuteBulkOperation} from '../../../services/store-bulk-execute-operation.js'
import {loadQuery} from '../../../utilities/execute-command-helpers.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import BaseCommand from '@shopify/cli-kit/node/base-command'

export default class StoreBulkExecute extends BaseCommand {
  static summary = 'Execute bulk operations against a store.'

  static descriptionWithMarkdown = `Executes an Admin API GraphQL query or mutation on the specified store as a bulk operation, authenticated as the current user.

  Unlike [\`app bulk execute\`](https://shopify.dev/docs/api/shopify-cli/app/app-bulk-execute), this command does not require an app to be linked or installed on the target store.

  Bulk operations allow you to process large amounts of data asynchronously. Learn more about [bulk query operations](https://shopify.dev/docs/api/usage/bulk-operations/queries) and [bulk mutation operations](https://shopify.dev/docs/api/usage/bulk-operations/imports).

  Use [\`store bulk status\`](https://shopify.dev/docs/api/shopify-cli/store/store-bulk-status) to check the status of your bulk operations.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...storeBulkOperationFlags,
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(StoreBulkExecute)
    const query = await loadQuery(flags)
    await storeExecuteBulkOperation({
      storeFqdn: flags.store,
      query,
      variables: flags.variables,
      variableFile: flags['variable-file'],
      watch: flags.watch ?? false,
      outputFile: flags['output-file'],
      ...(flags.version && {version: flags.version}),
    })
  }
}
