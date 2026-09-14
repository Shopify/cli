import {cancelMigrationOperation} from './partners-api.js'
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const MigrationOperationResultNodeSchema = zod.object({
  shopId: zod.string(),
  code: zod.enum([
    'SCHEDULED',
    'CANCELED',
    'INVALID_PLAN',
    'INELIGIBLE',
    'BLOCKED',
    'ALREADY_SCHEDULED',
    'ALREADY_MIGRATED',
    'NOT_FOUND',
    'INTERNAL_ERROR',
  ]),
})

const MigrationOperationResultEdgeSchema = zod.object({node: MigrationOperationResultNodeSchema})

const MigrationOperationSchema = zod.object({
  id: zod.string(),
  status: zod.enum(['RUNNING', 'COMPLETED', 'FAILED', 'CANCELED']),
  total: zod.number(),
  results: zod.object({edges: zod.array(MigrationOperationResultEdgeSchema)}),
})

const MigrationUserErrorSchema = zod.object({
  message: zod.string(),
  field: zod.array(zod.string()).nullable(),
})

const MigrationCancellationOutcomeSchema = zod.discriminatedUnion('status', [
  zod.object({
    status: zod.literal('success'),
    operationId: zod.string(),
    operation: MigrationOperationSchema,
  }),
  zod.object({
    status: zod.literal('failed'),
    operationId: zod.string(),
    operation: MigrationOperationSchema.nullable(),
    userErrors: zod.array(MigrationUserErrorSchema),
  }),
])

export const migrationCancellationJsonOutputSchema = defineJsonOutputSchema({
  name: 'MigrationCancellationResult',
  schema: zod.object({
    schemaVersion: zod.literal(1),
    outcomes: zod.array(MigrationCancellationOutcomeSchema),
  }),
  definitions: {
    MigrationCancellationOutcome: MigrationCancellationOutcomeSchema,
    MigrationOperation: MigrationOperationSchema,
    MigrationOperationResultEdge: MigrationOperationResultEdgeSchema,
    MigrationOperationResultNode: MigrationOperationResultNodeSchema,
    MigrationUserError: MigrationUserErrorSchema,
  },
})

export type MigrationCancellationJsonOutput = InferJsonOutputSchema<typeof migrationCancellationJsonOutputSchema>
export type MigrationCancellationResult = Omit<MigrationCancellationJsonOutput, 'schemaVersion'>
export type MigrationCancellationOutcome = MigrationCancellationResult['outcomes'][number]

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
