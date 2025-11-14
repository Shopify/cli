import {runBulkOperationQuery} from './run-query.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {renderSuccess, renderInfo, renderWarning} from '@shopify/cli-kit/node/ui'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'

interface ExecuteBulkOperationInput {
  app: AppLinkedInterface
  storeFqdn: string
  query: string
}

export async function executeBulkOperation(input: ExecuteBulkOperationInput): Promise<void> {
  const {app, storeFqdn, query} = input

  renderInfo({
    headline: 'Starting bulk operation.',
    body: `App: ${app.name}\nStore: ${storeFqdn}`,
  })

  const bulkOperationResponse = await runBulkOperationQuery({
    storeFqdn,
    query,
  })

  if (bulkOperationResponse?.userErrors?.length) {
    const errorMessages = bulkOperationResponse.userErrors
      .map(
        (error: {field?: string[] | null; message: string}) =>
          `${error.field?.join('.') ?? 'unknown'}: ${error.message}`,
      )
      .join('\n')
    renderWarning({
      headline: 'Bulk operation errors.',
      body: errorMessages,
    })
    return
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
}
