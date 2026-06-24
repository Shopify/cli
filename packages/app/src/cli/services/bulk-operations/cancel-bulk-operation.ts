import {formatOperationInfo, createAdminSessionAsApp} from '../graphql/common.js'
import {OrganizationApp, Organization} from '../../models/organization.js'
import {
  cancelBulkOperationRequest,
  renderBulkOperationUserErrors,
  formatBulkOperationCancellationResult,
  extractBulkOperationId,
} from '@shopify/cli-kit/node/api/bulk-operations'
import {renderInfo, renderError, renderSuccess, renderWarning, TokenItem} from '@shopify/cli-kit/node/ui'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'

interface CancelBulkOperationOptions {
  organization: Organization
  storeFqdn: string
  operationId: string
  remoteApp: OrganizationApp
}

export async function cancelBulkOperation(options: CancelBulkOperationOptions): Promise<void> {
  const {organization, storeFqdn, operationId, remoteApp} = options

  renderInfo({
    headline: 'Canceling bulk operation.',
    body: [
      {
        list: {
          items: [`ID: ${operationId}`, ...formatOperationInfo({organization, remoteApp, storeFqdn})],
        },
      },
    ],
  })

  const adminSession = await createAdminSessionAsApp(remoteApp, storeFqdn)

  const bulkOperationCancel = await cancelBulkOperationRequest({adminSession, operationId})

  if (bulkOperationCancel?.userErrors?.length) {
    renderBulkOperationUserErrors(bulkOperationCancel.userErrors, 'Failed to cancel bulk operation.')
    return
  }

  const operation = bulkOperationCancel?.bulkOperation
  if (operation) {
    const result = formatBulkOperationCancellationResult(operation)
    // The engine is command-agnostic; this command writes its own "check status" hint.
    const body: TokenItem | undefined =
      operation.status === 'CANCELING'
        ? [
            'This may take a few moments. Check the status with:\n',
            {command: `shopify app bulk status --id=${extractBulkOperationId(operation.id)}`},
          ]
        : result.body
    const renderOptions = {
      headline: result.headline,
      ...(body && {body}),
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
