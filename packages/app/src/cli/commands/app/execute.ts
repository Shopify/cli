import {appFlags, bulkOperationFlags} from '../../flags.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../services/app-context.js'
import {storeContext} from '../../services/store-context.js'
import {executeBulkOperation} from '../../services/bulk-operations/execute-bulk-operation.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class Execute extends AppLinkedCommand {
  static summary = 'Execute bulk operations.'

  static description = 'Execute bulk operations against the Shopify Admin API.'

  static hidden = true

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...bulkOperationFlags,
  }

  async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(Execute)

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

    await executeBulkOperation({
      app: appContextResult.app,
      storeFqdn: store.shopDomain,
      query: flags.query,
    })

    return {app: appContextResult.app}
  }
}
