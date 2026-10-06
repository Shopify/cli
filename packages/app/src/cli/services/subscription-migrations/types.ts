import {defineJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'
import type {MigrationOperation} from '../../models/subscription-migrations.js'
import type {MigrationUserError} from './partners-api.js'

export const MigrationOperationGidSchema = zod
  .string()
  .regex(/^gid:\/\/shopify\/AppSubscriptionMigrationOperation\/[^/]+$/)
  .describe('The Shopify AppSubscriptionMigrationOperation GID.')

export const ShopGidSchema = zod
  .string()
  .regex(/^gid:\/\/shopify\/Shop\/\d+$/)
  .describe('The Shopify Shop GID.')

export const MigrationOperationSchema = zod
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

export const MigrationUserErrorSchema = zod
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
      error: zod
        .object({
          type: zod.literal('abort'),
          message: zod.string(),
          details: zod.object({userErrors: zod.array(MigrationUserErrorSchema)}).strict(),
        })
        .strict(),
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
