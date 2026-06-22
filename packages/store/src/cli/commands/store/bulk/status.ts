import {
  getBulkOperationStatus,
  listBulkOperations,
  normalizeBulkOperationId,
} from '../../../services/store/bulk/bulk-operation-status.js'
import StoreCommand from '../../../utilities/store-command.js'
import {storeFlags} from '../../../flags.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

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
    id: Flags.string({
      description:
        'The bulk operation ID (numeric ID or full GID). If not provided, lists all bulk operations on this store in the last 7 days.',
      env: 'SHOPIFY_FLAG_ID',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(StoreBulkStatus)

    if (flags.id) {
      await getBulkOperationStatus({
        store: flags.store,
        operationId: normalizeBulkOperationId(flags.id),
      })
    } else {
      await listBulkOperations({store: flags.store})
    }
  }
}
