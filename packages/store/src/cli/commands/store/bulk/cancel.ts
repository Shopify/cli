import {cancelBulkOperation} from '../../../services/store/bulk/cancel-bulk-operation.js'
import {prepareBulkAdminContext} from '../../../services/store/bulk/bulk-admin-context.js'
import {renderCancelBulkOperationResult} from '../../../services/store/bulk/cancel-result.js'
import {renderBulkOperationStart} from '../../../services/store/bulk/progress.js'
import {cancelBulkOperationJsonOutputSchema} from '../../../services/store/bulk/types.js'
import StoreCommand from '../../../utilities/store-command.js'
import {requiredBulkOperationIdFlag, storeFlags} from '../../../flags.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class StoreBulkCancel extends StoreCommand {
  static summary = 'Cancel a bulk operation on a store.'

  static descriptionWithMarkdown = `Cancels a running bulk operation by ID, using previously stored app authentication.

  Run \`shopify store auth\` first to create stored auth for the store.`

  static description = this.descriptionForHelp()

  static examples = ['<%= config.bin %> <%= command.id %> --store shop.myshopify.com --id 123456789']

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    store: storeFlags.store,
    id: requiredBulkOperationIdFlag,
  }

  static get jsonOutputSchema() {
    return cancelBulkOperationJsonOutputSchema
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(StoreBulkCancel)
    const format = flags.json ? 'json' : 'text'
    const adminSession = await prepareBulkAdminContext(flags.store)
    renderBulkOperationStart(
      'Canceling bulk operation.',
      {storeFqdn: adminSession.storeFqdn, operationId: flags.id},
      format,
    )
    const result = await cancelBulkOperation({
      adminSession,
      operationId: flags.id,
    })
    renderCancelBulkOperationResult(result, flags.id, format)
  }
}
