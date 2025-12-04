import {appFlags, bulkOperationFlags} from '../../../flags.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {executeBulkOperation} from '../../../services/bulk-operations/execute-bulk-operation.js'
import {prepareExecuteContext} from '../../../utilities/execute-command-helpers.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class BulkExecute extends AppLinkedCommand {
  static summary = 'Execute bulk operations.'

  static description = 'Execute bulk operations against the Shopify Admin API.'

  static hidden = true

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...bulkOperationFlags,
  }

  async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(BulkExecute)

    const {query, appContextResult, store} = await prepareExecuteContext(flags, 'bulk execute')

    await executeBulkOperation({
      remoteApp: appContextResult.remoteApp,
      storeFqdn: store.shopDomain,
      query,
      variables: flags.variables,
      variableFile: flags['variable-file'],
      watch: flags.watch,
      outputFile: flags['output-file'],
      ...(flags.version && {version: flags.version}),
    })

    return {app: appContextResult.app}
  }
}
