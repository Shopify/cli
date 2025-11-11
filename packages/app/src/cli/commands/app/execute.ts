import {appFlags, bulkOperationFlags} from '../../flags.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../services/app-context.js'
import {storeContext} from '../../services/store-context.js'
import {runBulkOperationQuery} from '../../services/bulk-operation-run-query.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {renderSuccess, renderInfo, renderWarning} from '@shopify/cli-kit/node/ui'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'

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

    renderInfo({
      headline: 'Starting bulk operation.',
      body: `App: ${appContextResult.app.name}\nStore: ${store.shopDomain}`,
    })

    const bulkOperationResponse = await runBulkOperationQuery({
      storeFqdn: store.shopDomain,
      query: flags.query,
    })

    if (bulkOperationResponse?.userErrors?.length) {
      const errorMessages = bulkOperationResponse.userErrors
        .map((error) => `${error.field?.join('.') ?? 'unknown'}: ${error.message}`)
        .join('\n')
      renderWarning({
        headline: 'Bulk operation errors.',
        body: errorMessages,
      })
      return {app: appContextResult.app}
    }

    const result = bulkOperationResponse?.bulkOperation
    if (result) {
      const infoSections = [
        {
          title: 'Bulk Operation Created',
          body: [
            {
              list: {
                items: [
                  outputContent`ID: ${outputToken.cyan(result.id)}`.value,
                  outputContent`Status: ${outputToken.yellow(result.status)}`.value,
                  outputContent`Created: ${outputToken.gray(String(result.createdAt))}`.value,
                ],
              },
            },
          ],
        },
      ]

      renderInfo({customSections: infoSections})

      renderSuccess({
        headline: 'Bulk operation started successfully!',
        body: 'Congrats!',
      })
    }

    return {app: appContextResult.app}
  }
}
