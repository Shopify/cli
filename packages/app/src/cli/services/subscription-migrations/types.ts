import {JsonAbortErrorSchema, JsonErrorSchema} from '@shopify/cli-kit/node/error/schema'
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'
import type {MigrationOperation} from '../../models/subscription-migrations.js'
import type {MigrationUserError} from './partners-api.js'

export const MigrationOperationGidSchema = zod
  .string()
  .regex(/^gid:\/\/shopify\/AppSubscriptionMigrationOperation\/[^/]+$/)
  .describe('The Shopify AppSubscriptionMigrationOperation GID.')

const ShopGidSchema = zod
  .string()
  .regex(/^gid:\/\/shopify\/Shop\/\d+$/)
  .describe('The Shopify Shop GID.')

const MigrationOperationSchema = zod
  .object({
    gid: MigrationOperationGidSchema,
    status: zod.string().min(1).describe('Upstream status: RUNNING, COMPLETED, FAILED, or CANCELED.'),
    total: zod.number().int().nonnegative(),
    results: zod.array(
      zod
        .object({
          shopGid: ShopGidSchema,
          code: zod.string().min(1).describe('The upstream per-shop migration result code.'),
        })
        .strict(),
    ),
  })
  .strict()

const MigrationUserErrorSchema = zod
  .object({message: zod.string(), fieldPath: zod.array(zod.string()).nullable()})
  .strict()

const MigrationCancellationOutcomeSchema = zod.discriminatedUnion('status', [
  zod
    .object({
      status: zod.literal('success'),
      operationGid: MigrationOperationGidSchema,
      operation: MigrationOperationSchema,
    })
    .strict(),
  zod
    .object({
      status: zod.literal('failed'),
      operationGid: MigrationOperationGidSchema,
      operation: MigrationOperationSchema.nullable(),
      error: zod.union([
        JsonAbortErrorSchema.extend({
          details: zod.object({userErrors: zod.array(MigrationUserErrorSchema)}).strict(),
        }),
        JsonErrorSchema,
      ]),
    })
    .strict(),
])

export const migrationCancellationJsonOutputSchema = defineJsonOutputSchema({
  name: 'MigrationCancellationResult',
  schema: zod
    .object({
      status: zod.enum(['success', 'partial']),
      operations: zod.array(MigrationCancellationOutcomeSchema),
    })
    .strict(),
  definitions: {
    MigrationCancellationOutcome: MigrationCancellationOutcomeSchema,
    MigrationOperation: MigrationOperationSchema,
    MigrationUserError: MigrationUserErrorSchema,
  },
})

export interface MigrationCancellationResult {
  outcomes: MigrationCancellationOutcome[]
}

export type MigrationCancellationOutcome =
  | {status: 'success'; operationId: string; operation: MigrationOperation}
  | {status: 'failed'; operationId: string; operation: MigrationOperation | null; userErrors: MigrationUserError[]}
  | {status: 'failed'; operationId: string; operation: null; error: unknown}

const UtcInstantSchema = zod
  .string()
  .datetime()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
const CalendarDateSchema = zod.string().date()

const MigratableSubscriptionPriceSchema = zod
  .object({
    amount: zod.string().regex(/^-?\d+(?:\.\d+)?$/),
    currencyCode: zod.string().regex(/^[A-Z]{3}$/),
  })
  .strict()

const MigratableSubscriptionNotificationSchema = zod
  .object({
    kind: zod.string().describe('Known values: NONE, OPT_OUT, WHEN_REQUIRED.'),
    optOutDeadline: UtcInstantSchema.nullable(),
    sentAt: UtcInstantSchema.nullable(),
  })
  .strict()

const MigratableSubscriptionSchema = zod
  .object({
    shopGid: ShopGidSchema,
    status: zod.string().describe('Known values: UNSCHEDULED, SCHEDULED, MIGRATED.'),
    manualSubscriptionName: zod.string().nullable(),
    manualSubscriptionPrice: MigratableSubscriptionPriceSchema.nullable(),
    manualSubscriptionInterval: zod.string().describe('Known values: EVERY_30_DAYS, ANNUAL.'),
    targetPlanHandle: zod.string().nullable(),
    notification: MigratableSubscriptionNotificationSchema.nullable(),
    priceBehavior: zod.string().nullable().describe('Known values: HONOR_BILLING_PRICE, PLAN_PRICE.'),
    effectiveDate: zod
      .union([CalendarDateSchema, UtcInstantSchema])
      .nullable()
      .describe('The upstream calendar date or whole-second UTC instant; date-only values retain their format.'),
    lastFailureReason: zod.string().nullable().describe('Known values: SUPERSEDED, SCHEDULING_FAILED.'),
  })
  .strict()
  .describe('All subscription projection fields are present; unavailable values are null.')

export const migrationListJsonOutputSchema = defineJsonOutputSchema({
  name: 'MigrationListResult',
  schema: zod
    .object({
      subscriptions: zod.array(MigratableSubscriptionSchema).describe('The complete list across every fetched page.'),
    })
    .strict(),
  definitions: {
    MigratableSubscription: MigratableSubscriptionSchema,
    MigratableSubscriptionPrice: MigratableSubscriptionPriceSchema,
    MigratableSubscriptionNotification: MigratableSubscriptionNotificationSchema,
  },
})

const SubmittedMigrationOperationSchema = zod
  .object({
    batchIndex: zod.number().int().nonnegative(),
    batchPayloadDigest: zod.string().min(1),
    operation: MigrationOperationSchema,
  })
  .strict()

const MigrationSubmissionFailureSchema = zod.discriminatedUnion('type', [
  zod
    .object({
      type: zod.literal('submission'),
      batchIndex: zod.number().int().nonnegative(),
      userErrors: zod.array(MigrationUserErrorSchema),
    })
    .strict(),
  zod.object({type: zod.literal('operations'), operationGids: zod.array(MigrationOperationGidSchema)}).strict(),
])

const MigrationSubmissionSchema = zod
  .object({
    clientId: zod.string().min(1).describe('The app client ID, not a Shopify GID.'),
    action: zod.enum(['schedule', 'unschedule']),
    inputDigest: zod.string().min(1),
    total: zod.number().int().nonnegative(),
    operations: zod.array(SubmittedMigrationOperationSchema),
  })
  .strict()

export const migrationSubmissionJsonOutputSchema = defineJsonOutputSchema({
  name: 'MigrationSubmissionResult',
  schema: zod.discriminatedUnion('status', [
    zod.object({status: zod.literal('success'), changed: zod.boolean(), ...MigrationSubmissionSchema.shape}).strict(),
    zod
      .object({
        status: zod.literal('partial'),
        changed: zod.boolean(),
        ...MigrationSubmissionSchema.shape,
        failure: MigrationSubmissionFailureSchema,
      })
      .strict(),
    zod
      .object({
        status: zod.literal('cancelled'),
        changed: zod.literal(false),
        action: zod.enum(['schedule', 'unschedule']),
        reason: zod.string(),
      })
      .strict(),
  ]),
  definitions: {
    SubmittedMigrationOperation: SubmittedMigrationOperationSchema,
    MigrationOperation: MigrationOperationSchema,
    MigrationSubmissionFailure: MigrationSubmissionFailureSchema,
    MigrationUserError: MigrationUserErrorSchema,
  },
})

export type MigrationSubmissionJsonOutput = InferJsonOutputSchema<typeof migrationSubmissionJsonOutputSchema>
export interface MigrationSubmission {
  clientId: string
  action: 'schedule' | 'unschedule'
  inputDigest: string
  total: number
  operations: {batchIndex: number; batchPayloadDigest: string; operation: MigrationOperation}[]
}

type MigrationSubmissionFailure =
  | {type: 'submission'; batchIndex: number; userErrors: MigrationUserError[]}
  | {type: 'operations'; operationIds: string[]}
export type MigrationSubmissionResult =
  | {status: 'success'; submission: MigrationSubmission}
  | {status: 'failed'; submission: MigrationSubmission; failure: MigrationSubmissionFailure}
  | {status: 'cancelled'; changed: false; action: 'schedule' | 'unschedule'; reason: string}
