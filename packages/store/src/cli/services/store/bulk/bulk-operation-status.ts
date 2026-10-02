import {bulkOperationStatusJsonOutputSchema, type BulkOperationStatusResult} from './types.js'
import {
  BULK_OPERATIONS_MIN_API_VERSION,
  fetchBulkOperationById,
  fetchRecentBulkOperations,
  resolveApiVersion,
} from '@shopify/cli-kit/node/api/bulk-operations'

export async function getBulkOperationStatus(
  options: Pick<Parameters<typeof fetchBulkOperationById>[0], 'adminSession' | 'operationId'>,
): Promise<BulkOperationStatusResult> {
  const version = await resolveApiVersion({
    adminSession: options.adminSession,
    minimumDefaultVersion: BULK_OPERATIONS_MIN_API_VERSION,
  })
  const operation = await fetchBulkOperationById({...options, version})
  return bulkOperationStatusJsonOutputSchema.validate({
    store: options.adminSession.storeFqdn,
    apiVersion: version,
    operationId: options.operationId,
    operation: operation ?? null,
  })
}

export async function listBulkOperations(
  options: Pick<Parameters<typeof fetchRecentBulkOperations>[0], 'adminSession'>,
): Promise<BulkOperationStatusResult> {
  const version = await resolveApiVersion({
    adminSession: options.adminSession,
    minimumDefaultVersion: BULK_OPERATIONS_MIN_API_VERSION,
  })
  const operations = await fetchRecentBulkOperations({...options, version})
  return bulkOperationStatusJsonOutputSchema.validate({
    store: options.adminSession.storeFqdn,
    apiVersion: version,
    operations,
  })
}
