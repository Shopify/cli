import {GetBulkOperationByIdQuery} from '../../api/graphql/bulk-operations/generated/get-bulk-operation-by-id.js'
import {outputContent, outputToken, TokenizedString} from '@shopify/cli-kit/node/output'

export function formatBulkOperationStatus(
  operation: NonNullable<GetBulkOperationByIdQuery['bulkOperation']>,
): TokenizedString {
  switch (operation.status) {
    case 'RUNNING':
      return outputContent`Bulk operation in progress... ${outputToken.gray(
        `(${String(operation.objectCount)} objects)`,
      )}`
    case 'CREATED':
      return outputContent`Starting...`
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
