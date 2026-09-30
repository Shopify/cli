import {cancelBulkOperationJsonOutputSchema, type CancelBulkOperationResult} from './types.js'
import {BULK_OPERATIONS_MIN_API_VERSION, cancelBulkOperationRequest} from '@shopify/cli-kit/node/api/bulk-operations'

export async function cancelBulkOperation(
  options: Parameters<typeof cancelBulkOperationRequest>[0],
): Promise<CancelBulkOperationResult> {
  const response = await cancelBulkOperationRequest(options)
  return cancelBulkOperationJsonOutputSchema.validate({
    store: options.adminSession.storeFqdn,
    apiVersion: options.version ?? BULK_OPERATIONS_MIN_API_VERSION,
    operation: response?.bulkOperation ?? null,
    userErrors: response?.userErrors ?? [],
  })
}
