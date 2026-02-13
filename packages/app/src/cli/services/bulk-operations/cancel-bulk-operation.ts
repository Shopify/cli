import {renderBulkOperationUserErrors, formatBulkOperationCancellationResult} from './format-bulk-operation-status.js'
import {
  BulkOperationCancel,
  BulkOperationCancelMutation,
  BulkOperationCancelMutationVariables,
} from '../../api/graphql/bulk-operations/generated/bulk-operation-cancel.js'
import {formatOperationInfo, createAdminSessionAsApp} from '../graphql/common.js'
import {OrganizationApp, Organization} from '../../models/organization.js'
import {renderInfo, renderError, renderSuccess, renderWarning} from '@shopify/cli-kit/shared/node/ui'
import {outputContent, outputToken} from '@shopify/cli-kit/shared/node/output'
import {adminRequestDoc} from '@shopify/cli-kit/admin/api'

const API_VERSION = '2026-01'

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
