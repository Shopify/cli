import {getMigrationOperation} from './partners-api.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import type {MigrationOperation} from '../../models/subscription-migrations.js'

const DEFAULT_POLL_INTERVAL_MS = 1000
const TERMINAL_STATUSES = new Set<MigrationOperation['status']>(['COMPLETED', 'FAILED', 'CANCELED'])

interface WaitForOperationsOptions {
  clientId: string
  operationIds: string[]
  getOperation?: typeof getMigrationOperation
  pollIntervalMs?: number
  sleep?: (milliseconds: number) => Promise<void>
  onUpdate?: (operations: MigrationOperation[]) => void | Promise<void>
}

export async function waitForOperations({
  clientId,
  operationIds,
  getOperation = getMigrationOperation,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  sleep = delay,
  onUpdate,
}: WaitForOperationsOptions): Promise<MigrationOperation[]> {
  const operationsById = new Map<string, MigrationOperation>()
  const fingerprintsById = new Map<string, string>()
  let isFirstCycle = true
  let pendingIds = [...operationIds]

  while (pendingIds.length > 0) {
    // Each polling cycle depends on the terminal states observed in the previous cycle.
    // eslint-disable-next-line no-await-in-loop
    const operations = await Promise.all(
      pendingIds.map(async (operationId) => {
        const operation = await getOperation({clientId, operationId})
        if (!operation) throw new AbortError(`Migration operation not found: ${operationId}`)
        return {operationId, operation}
      }),
    )

    const hasChanged = operations.some(
      ({operationId, operation}) => fingerprintsById.get(operationId) !== JSON.stringify(operation),
    )
    for (const {operationId, operation} of operations) {
      operationsById.set(operationId, operation)
      fingerprintsById.set(operationId, JSON.stringify(operation))
    }

    if (onUpdate && (isFirstCycle || hasChanged)) {
      const latestOperations = operationIds.map((operationId) => operationsById.get(operationId)!)
      // eslint-disable-next-line no-await-in-loop
      await onUpdate(latestOperations)
    }
    isFirstCycle = false

    pendingIds = operations
      .filter(({operation}) => !TERMINAL_STATUSES.has(operation.status))
      .map(({operationId}) => operationId)

    // eslint-disable-next-line no-await-in-loop
    if (pendingIds.length > 0) await sleep(pollIntervalMs)
  }

  return operationIds.map((operationId) => operationsById.get(operationId)!)
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds))
}
