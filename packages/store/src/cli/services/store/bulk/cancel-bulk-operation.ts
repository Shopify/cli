import {formatOperationInfo} from './common.js'
import {prepareBulkAdminContext} from './bulk-admin-context.js'
import {
  cancelBulkOperationRequest,
  renderBulkOperationUserErrors,
  formatBulkOperationCancellationResult,
} from '@shopify/cli-kit/node/api/bulk-operations'
import {renderInfo, renderError, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'

interface CancelBulkOperationOptions {
  store: string
  operationId: string
}

export async function cancelBulkOperation(options: CancelBulkOperationOptions): Promise<void> {
  const {store, operationId} = options

  const {adminSession} = await prepareBulkAdminContext(store)

  renderInfo({
    headline: 'Canceling bulk operation.',
    body: [
      {
        list: {
          items: [`ID: ${operationId}`, ...formatOperationInfo({storeFqdn: adminSession.storeFqdn})],
        },
      },
    ],
  })

  const bulkOperationCancel = await cancelBulkOperationRequest({adminSession, operationId})

  if (bulkOperationCancel?.userErrors?.length) {
    renderBulkOperationUserErrors(bulkOperationCancel.userErrors, 'Failed to cancel bulk operation.')
    return
  }

  const operation = bulkOperationCancel?.bulkOperation
  if (operation) {
    const result = formatBulkOperationCancellationResult(operation, 'shopify store bulk status')
    const renderOptions = {
      headline: result.headline,
      ...(result.body && {body: result.body}),
      ...(result.customSections && {customSections: result.customSections}),
    }

    switch (result.renderType) {
      case 'success':
        renderSuccess(renderOptions)
        break
      case 'warning':
        renderWarning(renderOptions)
        break
      case 'info':
        renderInfo(renderOptions)
        break
    }
  } else {
    renderError({
      headline: 'Bulk operation not found or could not be canceled.',
      body: outputContent`ID: ${outputToken.yellow(operationId)}`.value,
    })
  }
}
