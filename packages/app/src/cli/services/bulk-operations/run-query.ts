import {
  BulkOperationRunQuery,
  BulkOperationRunQueryMutation,
} from '../../api/graphql/bulk-operations/generated/bulk-operation-run-query.js'
import {adminRequestDoc} from '@shopify/cli-kit/node/api/admin'
import {ensureAuthenticatedAdmin} from '@shopify/cli-kit/node/session'

interface BulkOperationRunQueryOptions {
  storeFqdn: string
  query: string
}

export async function runBulkOperationQuery(
  options: BulkOperationRunQueryOptions,
): Promise<BulkOperationRunQueryMutation['bulkOperationRunQuery']> {
  const {storeFqdn, query} = options
  const adminSession = await ensureAuthenticatedAdmin(storeFqdn)
  const response = await adminRequestDoc<BulkOperationRunQueryMutation, {query: string}>({
    query: BulkOperationRunQuery,
    session: adminSession,
    variables: {query},
  })

  return response.bulkOperationRunQuery
}
