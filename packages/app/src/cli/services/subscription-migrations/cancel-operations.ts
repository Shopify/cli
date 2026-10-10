import {cancelMigrationOperation} from './partners-api.js'
import {MigrationOperationGidSchema} from './types.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import type {MigrationCancellationOutcome, MigrationCancellationResult} from './types.js'

export class MigrationCancellationProtocolError extends Error {
  readonly operationId: string

  constructor(operationId: string) {
    super(`Migration cancellation for ${operationId} returned neither an operation nor user errors`)
    this.name = 'MigrationCancellationProtocolError'
    this.operationId = operationId
  }
}

interface CancelMigrationOperationsOptions {
  clientId: string
  operationIds: string[]
  cancelOperation?: typeof cancelMigrationOperation
}

export async function cancelMigrationOperations({
  clientId,
  operationIds,
  cancelOperation = cancelMigrationOperation,
}: CancelMigrationOperationsOptions): Promise<MigrationCancellationResult> {
  const invalidOperationIds = operationIds.filter(
    (operationId) => !MigrationOperationGidSchema.safeParse(operationId).success,
  )
  if (invalidOperationIds.length > 0) {
    throw new AbortError(
      `Invalid subscription migration operation IDs: ${invalidOperationIds.join(', ')}.`,
      'Use Shopify AppSubscriptionMigrationOperation GIDs returned by a migration submission.',
    )
  }
  const outcomes = await Promise.all(
    operationIds.map(async (operationId): Promise<MigrationCancellationOutcome> => {
      try {
        const payload = await cancelOperation({clientId, operationId})
        if (payload.userErrors.length > 0) {
          return {
            status: 'failed',
            operationId,
            operation: payload.operation,
            userErrors: payload.userErrors,
          }
        }
        if (!payload.operation) throw new MigrationCancellationProtocolError(operationId)
        return {status: 'success', operationId, operation: payload.operation}
      } catch (error) {
        if (operationIds.length === 1) throw error
        // Preserve every batch outcome even if one request fails after another cancellation succeeds.
        return {
          status: 'failed',
          operationId,
          operation: null,
          error,
        }
      }
    }),
  )
  return {outcomes}
}
