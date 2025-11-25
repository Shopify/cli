import {appFlags} from '../../../flags.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {storeContext} from '../../../services/store-context.js'
import {getBulkOperationStatus, listBulkOperations} from '../../../services/bulk-operations/bulk-operation-status.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'

export default class BulkStatus extends AppLinkedCommand {
  static summary = 'Check the status of bulk operations.'

  static description = 'Check the status of a specific bulk operation by ID, or list all recent bulk operations.'

  static hidden = true

  static flags = {
    ...globalFlags,
    ...appFlags,
    id: Flags.string({
      description: 'The bulk operation ID. If not provided, lists all recent bulk operations.',
      env: 'SHOPIFY_FLAG_ID',
    }),
    store: Flags.string({
      char: 's',
      description: 'The store domain. Must be an existing dev store.',
      env: 'SHOPIFY_FLAG_STORE',
      parse: async (input) => normalizeStoreFqdn(input),
    }),
  }

  async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(BulkStatus)

    const appContextResult = await linkedAppContext({
      directory: flags.path,
      clientId: flags['client-id'],
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })

    const store = await storeContext({
      appContextResult,
      storeFqdn: flags.store,
      forceReselectStore: flags.reset,
    })

    if (flags.id) {
      await getBulkOperationStatus({
        storeFqdn: store.shopDomain,
        operationId: flags.id,
        remoteApp: appContextResult.remoteApp,
      })
    } else {
      await listBulkOperations({
        storeFqdn: store.shopDomain,
        remoteApp: appContextResult.remoteApp,
      })
    }

    return {app: appContextResult.app}
  }
}
