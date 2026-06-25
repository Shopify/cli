import {cancelBulkOperation} from '../../../services/store/bulk/cancel-bulk-operation.js'
import StoreCommand from '../../../utilities/store-command.js'
import {requiredBulkOperationIdFlag, storeFlags} from '../../../flags.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class StoreBulkCancel extends StoreCommand {
  static summary = 'Cancel a bulk operation on a store.'

  static descriptionWithMarkdown = `Cancels a running bulk operation by ID, using previously stored app authentication.

  Run \`shopify store auth\` first to create stored auth for the store.`

  static description = this.descriptionWithoutMarkdown()

  static examples = ['<%= config.bin %> <%= command.id %> --store shop.myshopify.com --id 123456789']

  static flags = {
    ...globalFlags,
    store: storeFlags.store,
    id: requiredBulkOperationIdFlag,
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(StoreBulkCancel)

    await cancelBulkOperation({
      store: flags.store,
      operationId: flags.id,
    })
  }
}
