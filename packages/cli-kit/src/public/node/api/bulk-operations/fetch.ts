import {BULK_OPERATIONS_MIN_API_VERSION} from './constants.js'
import {adminRequestDoc} from '../admin.js'
import {AdminSession} from '../../session.js'
import {
  GetBulkOperationById,
  GetBulkOperationByIdQuery,
} from '../../../../cli/api/graphql/bulk-operations/generated/get-bulk-operation-by-id.js'
import {
  ListBulkOperations,
  ListBulkOperationsQuery,
  ListBulkOperationsQueryVariables,
} from '../../../../cli/api/graphql/bulk-operations/generated/list-bulk-operations.js'

interface FetchBulkOperationByIdOptions {
  adminSession: AdminSession
  operationId: string
  version?: string
}

/**
 * Fetches a single bulk operation by ID.
 *
 * @param options - The admin session, operation ID, and optional API version.
 * @returns The bulk operation, or null if it doesn't exist.
 */
export async function fetchBulkOperationById(
  options: FetchBulkOperationByIdOptions,
): Promise<GetBulkOperationByIdQuery['bulkOperation']> {
  const {adminSession, operationId, version} = options

  const response = await adminRequestDoc<GetBulkOperationByIdQuery, {id: string}>({
    query: GetBulkOperationById,
    session: adminSession,
    variables: {id: operationId},
    version: version ?? BULK_OPERATIONS_MIN_API_VERSION,
  })

  return response.bulkOperation
}

interface FetchRecentBulkOperationsOptions {
  adminSession: AdminSession
  version?: string
  /** Number of days back to include. Defaults to 7. */
  sinceDays?: number
  /** Maximum number of operations to return. Defaults to 100. */
  first?: number
}

/**
 * Fetches recent bulk operations for the store.
 *
 * @param options - The admin session, optional API version, look-back window, and page size.
 * @returns The list of bulk operation nodes, most recent first.
 */
export async function fetchRecentBulkOperations(
  options: FetchRecentBulkOperationsOptions,
): Promise<ListBulkOperationsQuery['bulkOperations']['nodes']> {
  const {adminSession, version, sinceDays = 7, first = 100} = options

  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const response = await adminRequestDoc<ListBulkOperationsQuery, ListBulkOperationsQueryVariables>({
    query: ListBulkOperations,
    session: adminSession,
    variables: {
      query: `created_at:>=${since}`,
      first,
      sortKey: 'CREATED_AT',
    },
    version: version ?? BULK_OPERATIONS_MIN_API_VERSION,
  })

  return response.bulkOperations.nodes
}
