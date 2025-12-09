import {appFlags} from '../../../flags.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {prepareAppStoreContext} from '../../../utilities/execute-command-helpers.js'
import {getBulkOperationStatus, listBulkOperations} from '../../../services/bulk-operations/bulk-operation-status.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'

export default class BulkStatus extends AppLinkedCommand {
  static summary = 'Check the status of bulk operations.'

  static descriptionWithMarkdown = `Check the status of a specific bulk operation by ID, or list all bulk operations in the last 7 days.

  Bulk operations allow you to process large amounts of data asynchronously. Learn more about [bulk query operations](https://shopify.dev/docs/api/usage/bulk-operations/queries) and [bulk mutation operations](https://shopify.dev/docs/api/usage/bulk-operations/imports).

  Use [\`bulk execute\`](https://shopify.dev/docs/api/shopify-cli/app/app-bulk-execute) to start a new bulk operation.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    id: Flags.string({
      description: 'The bulk operation ID. If not provided, lists all bulk operations in the last 7 days.',
      env: 'SHOPIFY_FLAG_ID',
    }),
    store: Flags.string({
      char: 's',
      description: 'The store domain. Must be an existing dev store.',
      env: 'SHOPIFY_FLAG_STORE',
      parse: async (input) => normalizeStoreFqdn(input),
    }),
  }

  async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(BulkStatus)

    const {appContextResult, store} = await prepareAppStoreContext(flags)

    if (flags.id) {
      await getBulkOperationStatus({
        storeFqdn: store.shopDomain,
        operationId: flags.id,
        remoteApp: appContextResult.remoteApp,
      })
    } else {
      await listBulkOperations({
        storeFqdn: store.shopDomain,
        remoteApp: appContextResult.remoteApp,
      })
    }

    return {app: appContextResult.app}
  }
}
