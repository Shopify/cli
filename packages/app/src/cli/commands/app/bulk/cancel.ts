import {appFlags} from '../../../flags.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {prepareAppStoreContext} from '../../../utilities/execute-command-helpers.js'
import {cancelBulkOperation} from '../../../services/bulk-operations/cancel-bulk-operation.js'
import {Args, Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'

export default class BulkCancel extends AppLinkedCommand {
  static summary = 'Cancel a bulk operation.'

  static description = 'Cancels a running bulk operation by ID.'

  static hidden = true

  static flags = {
    ...globalFlags,
    ...appFlags,
    id: Flags.string({
      description: 'The bulk operation ID to cancel (format: gid://shopify/BulkOperation/XXX).',
      env: 'SHOPIFY_FLAG_ID',
    }),
    store: Flags.string({
      char: 's',
      description: 'The store domain. Must be an existing dev store.',
      env: 'SHOPIFY_FLAG_STORE',
      parse: async (input) => normalizeStoreFqdn(input),
    }),
  }

  static args = {
    id: Args.string({
      description: 'The bulk operation ID to cancel (format: gid://shopify/BulkOperation/XXX).',
      required: false,
    }),
  }

  async run(): Promise<AppLinkedCommandOutput> {
    const {flags, args} = await this.parse(BulkCancel)

    const operationId = flags.id ?? args.id
    if (!operationId) {
      this.error('Bulk operation ID is required. Provide it via --id flag or as a positional argument.')
    }

    const {appContextResult, store} = await prepareAppStoreContext(flags)

    await cancelBulkOperation({
      organization: appContextResult.organization,
      storeFqdn: store.shopDomain,
      operationId,
      remoteApp: appContextResult.remoteApp,
    })

    return {app: appContextResult.app}
  }
}
