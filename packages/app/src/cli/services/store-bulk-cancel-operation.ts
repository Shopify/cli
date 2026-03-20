import {
  renderBulkOperationUserErrors,
  formatBulkOperationCancellationResult,
} from './bulk-operations/format-bulk-operation-status.js'
import {formatStoreOperationInfo} from './graphql/common.js'
import {
  BulkOperationCancel,
  BulkOperationCancelMutation,
  BulkOperationCancelMutationVariables,
} from '../api/graphql/bulk-operations/generated/bulk-operation-cancel.js'
import {renderInfo, renderError, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {ensureAuthenticatedAdmin} from '@shopify/cli-kit/node/session'
import {adminRequestDoc} from '@shopify/cli-kit/node/api/admin'

const API_VERSION = '2026-01'

interface StoreCancelBulkOperationOptions {
  storeFqdn: string
  operationId: string
}

export async function storeCancelBulkOperation(options: StoreCancelBulkOperationOptions): Promise<void> {
  const {storeFqdn, operationId} = options

  renderInfo({
    headline: 'Canceling bulk operation.',
    body: [
      {
        list: {
          items: [`ID: ${operationId}`, ...formatStoreOperationInfo({storeFqdn})],
        },
      },
    ],
  })

  const adminSession = await ensureAuthenticatedAdmin(storeFqdn)

  const response = await adminRequestDoc<BulkOperationCancelMutation, BulkOperationCancelMutationVariables>({
    query: BulkOperationCancel,
    session: adminSession,
    variables: {id: operationId},
    version: API_VERSION,
  })

  if (response.bulkOperationCancel?.userErrors?.length) {
    renderBulkOperationUserErrors(response.bulkOperationCancel.userErrors, 'Failed to cancel bulk operation.')
    return
  }

  const operation = response.bulkOperationCancel?.bulkOperation
  if (operation) {
    const result = formatBulkOperationCancellationResult(operation)
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
