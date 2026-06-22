import {
  BulkOperationRunQuery,
  BulkOperationRunQueryMutation,
} from '../../../../cli/api/graphql/bulk-operations/generated/bulk-operation-run-query.js'
import {adminRequestDoc} from '../admin.js'
import {AdminSession} from '../../session.js'

interface BulkOperationRunQueryOptions {
  adminSession: AdminSession
  query: string
  version?: string
}

/**
 * Starts a bulk query operation on the store.
 *
 * @param options - The admin session, query, and optional API version.
 * @returns The bulkOperationRunQuery result, including the created operation and any user errors.
 */
export async function runBulkOperationQuery(
  options: BulkOperationRunQueryOptions,
): Promise<BulkOperationRunQueryMutation['bulkOperationRunQuery']> {
  const {adminSession, query, version} = options

  const response = await adminRequestDoc<BulkOperationRunQueryMutation, {query: string}>({
    query: BulkOperationRunQuery,
    session: adminSession,
    variables: {query},
    ...(version && {version}),
  })

  return response.bulkOperationRunQuery
}
