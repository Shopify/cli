import {appFlags} from '../../../flags.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {prepareAppStoreContext} from '../../../utilities/execute-command-helpers.js'
import {cancelBulkOperation} from '../../../services/bulk-operations/cancel-bulk-operation.js'
import {cancelBulkOperationJsonOutputSchema} from '../../../services/bulk-operations/types.js'
import {renderCancelBulkOperationResult} from '../../../services/bulk-operations/cancel-result.js'
import {logBulkOperationStart} from '../../../services/bulk-operations/progress.js'
import {Flags} from '@oclif/core'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {normalizeBulkOperationId} from '@shopify/cli-kit/node/api/bulk-operations'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'

export default class BulkCancel extends AppLinkedCommand {
  static summary = 'Cancel a bulk operation.'

  static descriptionWithMarkdown = 'Cancels a running bulk operation by ID.'

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    ...appFlags,
    id: Flags.string({
      description: 'The bulk operation ID to cancel (numeric ID or full GID).',
      env: 'SHOPIFY_FLAG_ID',
      required: true,
    }),
    store: Flags.string({
      char: 's',
      description: 'The store domain. Must be an existing dev store.',
      env: 'SHOPIFY_FLAG_STORE',
      parse: async (input) => normalizeStoreFqdn(input),
    }),
  }

  static get jsonOutputSchema() {
    return cancelBulkOperationJsonOutputSchema
  }

  async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(BulkCancel)

    const {appContextResult, store} = await prepareAppStoreContext(flags)
    const format = flags.json ? 'json' : 'text'
    const operationId = normalizeBulkOperationId(flags.id)
    logBulkOperationStart(
      'Canceling bulk operation.',
      {
        organization: appContextResult.organization,
        remoteApp: appContextResult.remoteApp,
        storeFqdn: store.shopDomain,
        operationId,
      },
      format,
    )
    const result = await cancelBulkOperation({
      storeFqdn: store.shopDomain,
      operationId,
      remoteApp: appContextResult.remoteApp,
    })
    renderCancelBulkOperationResult(result, operationId, format)

    return {app: appContextResult.app}
  }
}
