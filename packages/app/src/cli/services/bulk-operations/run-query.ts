import {
  BulkOperationRunQuery,
  BulkOperationRunQueryMutation,
} from '../../api/graphql/bulk-operations/generated/bulk-operation-run-query.js'
import {adminRequestDoc} from '@shopify/cli-kit/node/api/admin'
import {AdminSession} from '@shopify/cli-kit/node/session'

interface BulkOperationRunQueryOptions {
  adminSession: AdminSession
  query: string
}

export async function runBulkOperationQuery(
  options: BulkOperationRunQueryOptions,
): Promise<BulkOperationRunQueryMutation['bulkOperationRunQuery']> {
  const {adminSession, query} = options
  const response = await adminRequestDoc<BulkOperationRunQueryMutation, {query: string}>({
    query: BulkOperationRunQuery,
    session: adminSession,
    variables: {query},
  })

  return response.bulkOperationRunQuery
}
