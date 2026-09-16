import {cancelBulkOperationJsonOutputSchema, type CancelBulkOperationResult} from './types.js'
import {
  renderBulkOperationUserErrors,
  formatBulkOperationCancellationResult,
  extractBulkOperationId,
} from '@shopify/cli-kit/node/api/bulk-operations'
import {renderInfo, renderError, renderSuccess, renderWarning, TokenItem} from '@shopify/cli-kit/node/ui'
import {outputContent, outputToken, outputResult} from '@shopify/cli-kit/node/output'

export function renderCancelBulkOperationResult(
  result: CancelBulkOperationResult,
  operationId: string,
  format: 'text' | 'json',
): void {
  if (format === 'json') {
    outputResult(cancelBulkOperationJsonOutputSchema.encode(result))
    return
  }
  if (result.userErrors.length) {
    renderBulkOperationUserErrors(result.userErrors, 'Failed to cancel bulk operation.')
    return
  }

  const operation = result.operation
  if (operation) {
    const cancellation = formatBulkOperationCancellationResult(operation)
    // The engine is command-agnostic; this command writes its own "check status" hint.
    const body: TokenItem | undefined =
      operation.status === 'CANCELING'
        ? [
            'This may take a few moments. Check the status with:\n',
            {command: `shopify store bulk status --id=${extractBulkOperationId(operation.id)}`},
          ]
        : cancellation.body
    const renderOptions = {
      headline: cancellation.headline,
      ...(body && {body}),
      ...(cancellation.customSections && {customSections: cancellation.customSections}),
    }

    switch (cancellation.renderType) {
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
