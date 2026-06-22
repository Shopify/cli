import {BULK_OPERATIONS_MIN_API_VERSION} from './constants.js'
import {adminRequestDoc} from '../admin.js'
import {AdminSession} from '../../session.js'
import {
  BulkOperationCancel,
  BulkOperationCancelMutation,
  BulkOperationCancelMutationVariables,
} from '../../../../cli/api/graphql/bulk-operations/generated/bulk-operation-cancel.js'

interface CancelBulkOperationOptions {
  adminSession: AdminSession
  operationId: string
  version?: string
}

/**
 * Requests cancellation of a bulk operation.
 *
 * @param options - The admin session, operation ID, and optional API version.
 * @returns The bulkOperationCancel result, including any user errors.
 */
export async function cancelBulkOperationRequest(
  options: CancelBulkOperationOptions,
): Promise<BulkOperationCancelMutation['bulkOperationCancel']> {
  const {adminSession, operationId, version} = options

  const response = await adminRequestDoc<BulkOperationCancelMutation, BulkOperationCancelMutationVariables>({
    query: BulkOperationCancel,
    session: adminSession,
    variables: {id: operationId},
    version: version ?? BULK_OPERATIONS_MIN_API_VERSION,
  })

  return response.bulkOperationCancel
}
