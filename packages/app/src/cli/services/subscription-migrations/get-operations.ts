import {getMigrationOperation} from './partners-api.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import type {MigrationOperation} from '../../models/subscription-migrations.js'

interface GetMigrationOperationsOptions {
  clientId: string
  operationIds: string[]
  getOperation?: typeof getMigrationOperation
}

export async function getMigrationOperations({
  clientId,
  operationIds,
  getOperation = getMigrationOperation,
}: GetMigrationOperationsOptions): Promise<MigrationOperation[]> {
  return Promise.all(
    operationIds.map(async (operationId) => {
      const operation = await getOperation({clientId, operationId})
      if (!operation) throw new AbortError(`Migration operation not found: ${operationId}`)
      return operation
    }),
  )
}
