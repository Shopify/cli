import {cancelBulkOperationJsonOutputSchema, type CancelBulkOperationResult} from './types.js'
import {bulkOperationJsonContext, toBulkOperationJson} from './json.js'
import {
  renderBulkOperationUserErrors,
  formatBulkOperationCancellationResult,
  extractBulkOperationId,
} from '@shopify/cli-kit/node/api/bulk-operations'
import {renderInfo, renderError, renderSuccess, renderWarning, TokenItem} from '@shopify/cli-kit/node/ui'
import {outputContent, outputToken, outputResult} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'

export function renderCancelBulkOperationResult(
  result: CancelBulkOperationResult,
  operationId: string,
  format: 'text' | 'json',
): void {
  if (format === 'json') {
    if (result.userErrors.length || !result.operation) {
      const error = new AbortError('Failed to cancel bulk operation.')
      error.details = {
        ...bulkOperationJsonContext(result),
        operationGid: operationId,
        userErrors: result.userErrors,
      }
      throw error
    }
    outputResult(
      cancelBulkOperationJsonOutputSchema.encode({
        ...bulkOperationJsonContext(result),
        status: 'success',
        operation: toBulkOperationJson(result.operation),
      }),
    )
    return
  }
  if (result.userErrors.length) {
    renderBulkOperationUserErrors(result.userErrors, 'Failed to cancel bulk operation.')
    return
  }

  const operation = result.operation
  if (operation) {
    const cancellation = formatBulkOperationCancellationResult(operation)
    const body: TokenItem | undefined =
      operation.status === 'CANCELING'
        ? [
            'This may take a few moments. Check the status with:\n',
            {command: `shopify app bulk status --id=${extractBulkOperationId(operation.id)}`},
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
