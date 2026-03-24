import {storeCancelBulkOperation} from '../../../services/store-bulk-cancel-operation.js'
import {normalizeBulkOperationId} from '../../../services/bulk-operations/bulk-operation-status.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import BaseCommand from '@shopify/cli-kit/node/base-command'

export default class StoreBulkCancel extends BaseCommand {
  static summary = 'Cancel a bulk operation on a store.'

  static description = 'Cancels a running bulk operation by ID, authenticated as the current user.'

  static flags = {
    ...globalFlags,
    id: Flags.string({
      description: 'The bulk operation ID to cancel (numeric ID or full GID).',
      env: 'SHOPIFY_FLAG_ID',
      required: true,
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
    const {flags} = await this.parse(StoreBulkCancel)

    await storeCancelBulkOperation({
      storeFqdn: flags.store,
      operationId: normalizeBulkOperationId(flags.id),
    })
  }
}
