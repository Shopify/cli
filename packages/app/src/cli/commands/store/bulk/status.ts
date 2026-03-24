import {storeGetBulkOperationStatus, storeListBulkOperations} from '../../../services/store-bulk-operation-status.js'
import {normalizeBulkOperationId} from '../../../services/bulk-operations/bulk-operation-status.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import BaseCommand from '@shopify/cli-kit/node/base-command'

export default class StoreBulkStatus extends BaseCommand {
  static summary = 'Check the status of bulk operations on a store.'

  static descriptionWithMarkdown = `Check the status of a specific bulk operation by ID, or list all bulk operations on this store in the last 7 days.

  Unlike [\`app bulk status\`](https://shopify.dev/docs/api/shopify-cli/app/app-bulk-status), this command does not require an app to be linked or installed on the target store.

  Use [\`store bulk execute\`](https://shopify.dev/docs/api/shopify-cli/store/store-bulk-execute) to start a new bulk operation.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    id: Flags.string({
      description:
        'The bulk operation ID (numeric ID or full GID). If not provided, lists all bulk operations on this store in the last 7 days.',
      env: 'SHOPIFY_FLAG_ID',
    }),
    store: Flags.string({
      char: 's',
      description: 'The myshopify.com domain of the store.',
      env: 'SHOPIFY_FLAG_STORE',
      parse: async (input) => normalizeStoreFqdn(input),
      required: true,
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(StoreBulkStatus)

    if (flags.id) {
      await storeGetBulkOperationStatus({
        storeFqdn: flags.store,
        operationId: normalizeBulkOperationId(flags.id),
      })
    } else {
      await storeListBulkOperations({
        storeFqdn: flags.store,
      })
    }
  }
}
