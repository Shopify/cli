import {extractBulkOperationId} from './bulk-operation-status.js'
import {GetBulkOperationByIdQuery} from '../../api/graphql/bulk-operations/generated/get-bulk-operation-by-id.js'
import {outputContent, outputToken, TokenizedString} from '@shopify/cli-kit/shared/node/output'
import {renderError, TokenItem} from '@shopify/cli-kit/shared/node/ui'

export function formatBulkOperationStatus(
  operation: NonNullable<GetBulkOperationByIdQuery['bulkOperation']>,
): TokenizedString {
  switch (operation.status) {
    case 'RUNNING':
      return outputContent`Bulk operation in progress${
        (operation.objectCount as number) > 0
          ? outputToken.gray(
              ` (${String(operation.objectCount)} objects ${operation.type === 'MUTATION' ? 'written' : 'read'})`,
            )
          : ''
      }`
    case 'CREATED':
      return outputContent`Starting`
    case 'COMPLETED':
      return outputContent`Bulk operation succeeded: ${outputToken.gray(`${String(operation.objectCount)} objects`)}`
    case 'FAILED':
      return outputContent`Bulk operation failed. ${outputToken.errorText(
        `Error: ${operation.errorCode ?? 'unknown'}`,
      )}`
    case 'CANCELING':
      return outputContent`Bulk operation canceling...`
    case 'CANCELED':
      return outputContent`Bulk operation canceled.`
    case 'EXPIRED':
      return outputContent`Bulk operation expired.`
    default:
      return outputContent`Bulk operation status: ${operation.status}`
  }
}

interface UserError {
  field?: string[] | null
  message: string
}

export function renderBulkOperationUserErrors(userErrors: UserError[], headline: string): void {
  const errorMessages = userErrors
    .map((error) => outputContent`${error.field?.join('.') ?? 'unknown'}: ${error.message}`.value)
    .join('\n')

  renderError({
    headline,
    body: errorMessages,
  })
}

interface BulkOperationCancellationResult {
  headline: string
  body?: TokenItem
  customSections?: {body: {list: {items: string[]}}[]}[]
  renderType: 'success' | 'warning' | 'info'
}

export function formatBulkOperationCancellationResult(
  operation: NonNullable<GetBulkOperationByIdQuery['bulkOperation']>,
): BulkOperationCancellationResult {
  const headline = formatBulkOperationStatus(operation).value

  switch (operation.status) {
    case 'CANCELING':
      return {
        headline: 'Bulk operation is being cancelled.',
        body: [
          'This may take a few moments. Check the status with:\n',
          {command: `shopify app bulk status --id=${extractBulkOperationId(operation.id)}`},
        ],
        renderType: 'success',
      }
    case 'CANCELED':
    case 'COMPLETED':
    case 'FAILED': {
      const items = [
        outputContent`ID: ${outputToken.cyan(operation.id)}`.value,
        outputContent`Status: ${outputToken.yellow(operation.status)}`.value,
        outputContent`Created at: ${outputToken.gray(String(operation.createdAt))}`.value,
        ...(operation.completedAt
          ? [outputContent`Completed at: ${outputToken.gray(String(operation.completedAt))}`.value]
          : []),
      ]
      return {
        headline: outputContent`Bulk operation is already ${operation.status.toLowerCase()}.`.value,
        body: outputContent`This operation has already finished and can't be canceled.`.value,
        customSections: [{body: [{list: {items}}]}],
        renderType: 'warning',
      }
    }
    default:
      return {
        headline,
        renderType: 'info',
      }
  }
}
