import {cancelBulkOperation} from '../../../services/store/bulk/cancel-bulk-operation.js'
import {normalizeBulkOperationId} from '../../../services/store/bulk/bulk-operation-status.js'
import StoreCommand from '../../../utilities/store-command.js'
import {storeFlags} from '../../../flags.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

export default class StoreBulkCancel extends StoreCommand {
  static summary = 'Cancel a bulk operation on a store.'

  static descriptionWithMarkdown = `Cancels a running bulk operation by ID, using previously stored app authentication.

  Run \`shopify store auth\` first to create stored auth for the store.`

  static description = this.descriptionWithoutMarkdown()

  static examples = ['<%= config.bin %> <%= command.id %> --store shop.myshopify.com --id 123456789']

  static flags = {
    ...globalFlags,
    store: storeFlags.store,
    id: Flags.string({
      description: 'The bulk operation ID to cancel (numeric ID or full GID).',
      env: 'SHOPIFY_FLAG_ID',
      required: true,
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(StoreBulkCancel)

    await cancelBulkOperation({
      store: flags.store,
      operationId: normalizeBulkOperationId(flags.id),
    })
  }
}
