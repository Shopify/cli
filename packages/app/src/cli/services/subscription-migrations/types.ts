import {MIGRATABLE_SUBSCRIPTION_STATUSES, PRICE_BEHAVIORS} from '../../models/subscription-migrations.js'
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

const MigratableSubscriptionPriceSchema = zod.object({
  amount: zod.string(),
  currencyCode: zod.string(),
})

const MigratableSubscriptionNotificationSchema = zod.object({
  kind: zod.enum(['NONE', 'OPT_OUT', 'WHEN_REQUIRED']),
  optOutDeadline: zod.string().nullable(),
  sentAt: zod.string().nullable(),
})

const MigratableSubscriptionSchema = zod.object({
  shopId: zod.string(),
  status: zod.enum(MIGRATABLE_SUBSCRIPTION_STATUSES),
  manualSubscriptionName: zod.string().nullable(),
  manualSubscriptionPrice: MigratableSubscriptionPriceSchema.nullable(),
  manualSubscriptionInterval: zod.enum(['EVERY_30_DAYS', 'ANNUAL']),
  targetPlanHandle: zod.string().nullable(),
  notification: MigratableSubscriptionNotificationSchema.nullable(),
  priceBehavior: zod.enum(PRICE_BEHAVIORS).nullable(),
  effectiveDate: zod.string().nullable(),
  lastFailureReason: zod.enum(['SUPERSEDED', 'SCHEDULING_FAILED']).nullable(),
})

export const migrationListJsonOutputSchema = defineJsonOutputSchema({
  name: 'MigrationListResult',
  schema: zod.object({
    schemaVersion: zod.literal(1),
    subscriptions: zod.array(MigratableSubscriptionSchema),
  }),
  definitions: {
    MigratableSubscription: MigratableSubscriptionSchema,
    MigratableSubscriptionPrice: MigratableSubscriptionPriceSchema,
    MigratableSubscriptionNotification: MigratableSubscriptionNotificationSchema,
  },
})

export type MigrationListResult = InferJsonOutputSchema<typeof migrationListJsonOutputSchema>

const SubmittedMigrationOperationSchema = zod.object({
  batchIndex: zod.number(),
  batchPayloadDigest: zod.string(),
  operation: MigrationOperationSchema,
})

const MigrationSubmissionFailureSchema = zod.discriminatedUnion('type', [
  zod.object({
    type: zod.literal('submission'),
    batchIndex: zod.number(),
    userErrors: zod.array(MigrationUserErrorSchema),
  }),
  zod.object({
    type: zod.literal('operations'),
    operationIds: zod.array(zod.string()),
  }),
])

export const migrationSubmissionJsonOutputSchema = defineJsonOutputSchema({
  name: 'MigrationSubmissionResult',
  schema: zod.object({
    schemaVersion: zod.literal(1),
    clientId: zod.string(),
    action: zod.enum(['schedule', 'unschedule']),
    inputDigest: zod.string(),
    total: zod.number(),
    operations: zod.array(SubmittedMigrationOperationSchema),
    failure: MigrationSubmissionFailureSchema.optional(),
  }),
  definitions: {
    SubmittedMigrationOperation: SubmittedMigrationOperationSchema,
    MigrationOperation: MigrationOperationSchema,
    MigrationOperationResultEdge: MigrationOperationResultEdgeSchema,
    MigrationOperationResultNode: MigrationOperationResultNodeSchema,
    MigrationSubmissionFailure: MigrationSubmissionFailureSchema,
    MigrationUserError: MigrationUserErrorSchema,
  },
})

export type MigrationSubmissionJsonOutput = InferJsonOutputSchema<typeof migrationSubmissionJsonOutputSchema>
export type MigrationSubmission = Omit<MigrationSubmissionJsonOutput, 'schemaVersion' | 'failure'>
type MigrationSubmissionFailure = NonNullable<MigrationSubmissionJsonOutput['failure']>
export type MigrationSubmissionResult =
  | {status: 'success'; submission: MigrationSubmission}
  | {status: 'failed'; submission: MigrationSubmission; failure: MigrationSubmissionFailure}
