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

export type MigrationCancellationResult = InferJsonOutputSchema<typeof migrationCancellationJsonOutputSchema>
export type MigrationCancellationOutcome = MigrationCancellationResult['outcomes'][number]
