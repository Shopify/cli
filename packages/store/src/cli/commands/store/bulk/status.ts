import {getBulkOperationStatus, listBulkOperations} from '../../../services/store/bulk/bulk-operation-status.js'
import StoreCommand from '../../../utilities/store-command.js'
import {bulkOperationIdFlag, storeFlags} from '../../../flags.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class StoreBulkStatus extends StoreCommand {
  static summary = 'Check the status of bulk operations on a store.'

  static descriptionWithMarkdown = `Check the status of a specific bulk operation by ID, or list all bulk operations on this store in the last 7 days, using previously stored app authentication.

  Run \`shopify store auth\` first to create stored auth for the store.

  Use [\`store bulk execute\`](https://shopify.dev/docs/api/shopify-cli/store/store-bulk-execute) to start a new bulk operation.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com',
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --id 123456789',
  ]

  static flags = {
    ...globalFlags,
    store: storeFlags.store,
    id: bulkOperationIdFlag,
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(StoreBulkStatus)

    if (flags.id) {
      await getBulkOperationStatus({
        store: flags.store,
        operationId: flags.id,
      })
    } else {
      await listBulkOperations({store: flags.store})
    }
  }
}
