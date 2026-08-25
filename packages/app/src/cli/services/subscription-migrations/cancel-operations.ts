import {cancelMigrationOperation} from './partners-api.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import type {MigrationOperation} from '../../models/subscription-migrations.js'

interface CancelMigrationOperationsOptions {
  clientId: string
  operationIds: string[]
  cancelOperation?: typeof cancelMigrationOperation
}

export async function cancelMigrationOperations({
  clientId,
  operationIds,
  cancelOperation = cancelMigrationOperation,
}: CancelMigrationOperationsOptions): Promise<MigrationOperation[]> {
  return Promise.all(
    operationIds.map(async (operationId) => {
      const payload = await cancelOperation({clientId, operationId})
      if (payload.userErrors.length > 0) {
        throw new AbortError(payload.userErrors.map(({message}) => message).join('\n'))
      }
      if (!payload.operation) throw new AbortError(`Operation not found: ${operationId}`)
      return payload.operation
    }),
  )
}
