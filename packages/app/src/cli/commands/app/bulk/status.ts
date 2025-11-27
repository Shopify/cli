import {appFlags} from '../../../flags.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {storeContext} from '../../../services/store-context.js'
import {getBulkOperationStatus} from '../../../services/bulk-operations/bulk-operation-status.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'

export default class BulkStatus extends AppLinkedCommand {
  static summary = 'Check the status of a bulk operation.'

  static description = 'Check the status of a bulk operation by ID.'

  static hidden = true

  static flags = {
    ...globalFlags,
    ...appFlags,
    id: Flags.string({
      description: 'The bulk operation ID.',
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

    await getBulkOperationStatus({
      storeFqdn: store.shopDomain,
      operationId: flags.id,
      remoteApp: appContextResult.remoteApp,
    })

    return {app: appContextResult.app}
  }
}
