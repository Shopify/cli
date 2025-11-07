import {
  BulkOperationRunQuery,
  BulkOperation,
  BulkOperationError,
  BulkOperationRunQuerySchema,
} from '../api/graphql/admin-bulk-operations.js'
import {adminRequest} from '@shopify/cli-kit/node/api/admin'
import {ensureAuthenticatedAdmin} from '@shopify/cli-kit/node/session'

interface BulkOperationRunQueryOptions {
  storeFqdn: string
  query: string
}

/**
 * Executes a bulk operation query against the Shopify Admin API.
 * The operation runs asynchronously in the background.
 */
export async function runBulkOperationQuery(
  options: BulkOperationRunQueryOptions,
): Promise<{result?: BulkOperation; errors?: BulkOperationError[]}> {
  const {storeFqdn, query} = options
  const adminSession = await ensureAuthenticatedAdmin(storeFqdn)
  const response = await adminRequest<BulkOperationRunQuerySchema>(BulkOperationRunQuery, adminSession, {query})

  if (response.bulkOperationRunQuery.userErrors.length > 0) {
    return {
      errors: response.bulkOperationRunQuery.userErrors,
    }
  }

  const bulkOperation = response.bulkOperationRunQuery.bulkOperation
  if (bulkOperation) {
    return {result: bulkOperation}
  }

  return {
    errors: [{field: null, message: 'No bulk operation was created'}],
  }
}
