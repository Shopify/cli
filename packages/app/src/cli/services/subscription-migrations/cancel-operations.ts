import {cancelMigrationOperation, type MigrationUserError} from './partners-api.js'
import type {MigrationOperation} from '../../models/subscription-migrations.js'

export type MigrationCancellationOutcome =
  | {status: 'success'; operationId: string; operation: MigrationOperation}
  | {
      status: 'failed'
      operationId: string
      operation: MigrationOperation | null
      userErrors: MigrationUserError[]
    }

export interface MigrationCancellationResult {
  outcomes: MigrationCancellationOutcome[]
}

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
  const outcomes = await Promise.all(
    operationIds.map(async (operationId): Promise<MigrationCancellationOutcome> => {
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
    }),
  )
  return {outcomes}
}
