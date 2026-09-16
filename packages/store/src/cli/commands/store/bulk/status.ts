import {getBulkOperationStatus, listBulkOperations} from '../../../services/store/bulk/bulk-operation-status.js'
import {prepareBulkAdminContext} from '../../../services/store/bulk/bulk-admin-context.js'
import {renderBulkOperationStatusResult} from '../../../services/store/bulk/status-result.js'
import {renderBulkOperationStart} from '../../../services/store/bulk/progress.js'
import {bulkOperationStatusJsonOutputSchema} from '../../../services/store/bulk/types.js'
import StoreCommand from '../../../utilities/store-command.js'
import {bulkOperationIdFlag, storeFlags} from '../../../flags.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class StoreBulkStatus extends StoreCommand {
  static summary = 'Check the status of bulk operations on a store.'

  static descriptionWithMarkdown = `Check the status of a specific bulk operation by ID, or list all bulk operations on this store in the last 7 days, using previously stored app authentication.

  Run \`shopify store auth\` first to create stored auth for the store.

  Use [\`store bulk execute\`](https://shopify.dev/docs/api/shopify-cli/store/store-bulk-execute) to start a new bulk operation.`

  static description = this.descriptionForHelp()

  static examples = [
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com',
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --id 123456789',
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    store: storeFlags.store,
    id: bulkOperationIdFlag,
  }

  static get jsonOutputSchema() {
    return bulkOperationStatusJsonOutputSchema
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(StoreBulkStatus)
    const format = flags.json ? 'json' : 'text'
    const adminSession = await prepareBulkAdminContext(flags.store)
    renderBulkOperationStart(
      flags.id ? 'Checking bulk operation status.' : 'Listing bulk operations.',
      {storeFqdn: adminSession.storeFqdn},
      format,
    )
    const result = flags.id
      ? await getBulkOperationStatus({adminSession, operationId: flags.id})
      : await listBulkOperations({adminSession})
    renderBulkOperationStatusResult(result, format)
  }
}
