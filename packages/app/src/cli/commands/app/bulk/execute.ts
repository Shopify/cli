import {appFlags, bulkOperationFlags} from '../../../flags.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {executeBulkOperation} from '../../../services/bulk-operations/execute-bulk-operation.js'
import {prepareExecuteContext} from '../../../utilities/execute-command-helpers.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class BulkExecute extends AppLinkedCommand {
  static summary = 'Execute bulk operations.'

  static descriptionWithMarkdown = `Executes an Admin API GraphQL query or mutation on the specified store, as a bulk operation. Mutations are only allowed on dev stores.

  Bulk operations allow you to process large amounts of data asynchronously. Learn more about [bulk query operations](https://shopify.dev/docs/api/usage/bulk-operations/queries) and [bulk mutation operations](https://shopify.dev/docs/api/usage/bulk-operations/imports).

  Use [\`bulk status\`](https://shopify.dev/docs/api/shopify-cli/app/app-bulk-status) to check the status of your bulk operations.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...bulkOperationFlags,
  }

  async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(BulkExecute)

    const {query, appContextResult, store} = await prepareExecuteContext(flags)

    await executeBulkOperation({
      organization: appContextResult.organization,
      remoteApp: appContextResult.remoteApp,
      store,
      query,
      variables: flags.variables,
      variableFile: flags['variable-file'],
      watch: flags.watch ?? false,
      outputFile: flags['output-file'],
      ...(flags.version && {version: flags.version}),
    })

    return {app: appContextResult.app}
  }
}
