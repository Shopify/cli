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

const MigratableSubscriptionPriceSchema = zod.object({
  amount: zod.string(),
  currencyCode: zod.string(),
})

const MigratableSubscriptionNotificationSchema = zod.object({
  kind: zod.string().describe('Known values: NONE, OPT_OUT, WHEN_REQUIRED.'),
  optOutDeadline: zod.string().nullable(),
  sentAt: zod.string().nullable(),
})

// Server-provided values are typed as strings (with the known values documented) instead of enums, so a new
// server-side value never makes `--json` output fail validation. Compatibility with the `MigratableSubscription`
// model is enforced where `serializeMigrationListJson` passes the model into this schema's `encode`.
const MigratableSubscriptionSchema = zod.object({
  shopId: zod.string(),
  status: zod.string().describe('Known values: UNSCHEDULED, SCHEDULED, MIGRATED.'),
  manualSubscriptionName: zod.string().nullable(),
  manualSubscriptionPrice: MigratableSubscriptionPriceSchema.nullable(),
  manualSubscriptionInterval: zod.string().describe('Known values: EVERY_30_DAYS, ANNUAL.'),
  targetPlanHandle: zod.string().nullable(),
  notification: MigratableSubscriptionNotificationSchema.nullable(),
  priceBehavior: zod.string().nullable().describe('Known values: HONOR_BILLING_PRICE, PLAN_PRICE.'),
  effectiveDate: zod.string().nullable(),
  lastFailureReason: zod.string().nullable().describe('Known values: SUPERSEDED, SCHEDULING_FAILED.'),
})

export const migrationListJsonOutputSchema = defineJsonOutputSchema({
  name: 'MigrationListResult',
  schema: zod.object({
    subscriptions: zod.array(MigratableSubscriptionSchema),
  }),
  definitions: {
    MigratableSubscription: MigratableSubscriptionSchema,
    MigratableSubscriptionPrice: MigratableSubscriptionPriceSchema,
    MigratableSubscriptionNotification: MigratableSubscriptionNotificationSchema,
  },
})

export type MigrationListResult = InferJsonOutputSchema<typeof migrationListJsonOutputSchema>
