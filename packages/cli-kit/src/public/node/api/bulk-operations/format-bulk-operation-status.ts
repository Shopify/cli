import {extractBulkOperationId} from './helpers.js'
import {GetBulkOperationByIdQuery} from '../../../../cli/api/graphql/bulk-operations/generated/get-bulk-operation-by-id.js'
import {outputContent, outputToken, TokenizedString} from '../../output.js'
import {renderError, TokenItem} from '../../ui.js'

/**
 * Produces a human-readable status line for a bulk operation.
 *
 * @param operation - The bulk operation.
 * @returns A tokenized status string.
 */
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

/**
 * Renders a list of bulk operation user errors.
 *
 * @param userErrors - The user errors to render.
 * @param headline - The headline for the error block.
 */
export function renderBulkOperationUserErrors(userErrors: UserError[], headline: string): void {
  const errorMessages = userErrors
    .map((error) => outputContent`${error.field?.join('.') ?? 'unknown'}: ${error.message}`.value)
    .join('\n')

  renderError({
    headline,
    body: errorMessages,
  })
}

export interface BulkOperationCancellationResult {
  headline: string
  body?: TokenItem
  customSections?: {body: {list: {items: string[]}}[]}[]
  renderType: 'success' | 'warning' | 'info'
}

/**
 * Builds the rendering payload describing the outcome of a cancellation request.
 *
 * @param operation - The bulk operation after the cancel request.
 * @param statusCommand - The CLI command users run to check status (e.g. "shopify store bulk status").
 * @returns The headline, body, sections, and render type to use.
 */
export function formatBulkOperationCancellationResult(
  operation: NonNullable<GetBulkOperationByIdQuery['bulkOperation']>,
  statusCommand: string,
): BulkOperationCancellationResult {
  const headline = formatBulkOperationStatus(operation).value

  switch (operation.status) {
    case 'CANCELING':
      return {
        headline: 'Bulk operation is being cancelled.',
        body: [
          'This may take a few moments. Check the status with:\n',
          {command: `${statusCommand} --id=${extractBulkOperationId(operation.id)}`},
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
    case 'CREATED':
    case 'EXPIRED':
    case 'RUNNING':
      return {
        headline,
        renderType: 'info',
      }
  }
}
