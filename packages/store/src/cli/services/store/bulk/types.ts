import {
  defineJsonOutputSchema,
  jsonOutputTimestampSchema,
  type InferJsonOutputSchema,
} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'
import type {BulkOperation} from '@shopify/cli-kit/node/api/bulk-operations'

const BulkOperationGidSchema = zod
  .string()
  .regex(/^gid:\/\/shopify\/BulkOperation\/[^/]+$/)
  .describe('The Shopify global ID of a bulk operation.')

const BulkOperationSchema = zod
  .object({
    gid: BulkOperationGidSchema,
    // Shopify owns these enums; new upstream values must remain readable by the CLI.
    type: zod.string(),
    status: zod.string(),
    errorCode: zod.string().nullable(),
    createdAt: jsonOutputTimestampSchema,
    completedAt: jsonOutputTimestampSchema.nullable(),
    objectCount: zod
      .string()
      .regex(/^\d+$/)
      .describe('A nonnegative decimal count, without loss of integer precision.'),
    url: zod.string().url().nullable(),
    partialDataUrl: zod.string().url().nullable(),
  })
  .strict()

const ListedBulkOperationSchema = BulkOperationSchema.omit({type: true})
const BulkOperationContextSchema = zod
  .object({
    storeDomain: zod
      .string()
      .regex(/^[^.]+\.myshopify\.com$/)
      .nullable(),
    apiVersion: zod.string().nullable().describe('The API version selected for the request.'),
  })
  .strict()

export const cancelBulkOperationJsonOutputSchema = defineJsonOutputSchema({
  name: 'CancelBulkOperationResult',
  schema: BulkOperationContextSchema.extend({status: zod.literal('success'), operation: BulkOperationSchema}),
  definitions: {BulkOperation: BulkOperationSchema},
})

export type BulkOperationJson = InferJsonOutputSchema<typeof cancelBulkOperationJsonOutputSchema>['operation']
export type ListedBulkOperationJson = Omit<BulkOperationJson, 'type'>

const ExecuteBulkOperationResultSchema = BulkOperationContextSchema.extend({
  status: zod.enum(['success', 'partial', 'cancelled']),
  reason: zod.literal('watch-aborted').optional(),
  operation: BulkOperationSchema,
  resultsJsonl: zod.string().optional().describe('Downloaded results in their native JSONL format.'),
})
const BulkOperationFileSchema = zod
  .object({
    path: zod.string().describe('The absolute path of the downloaded results file.'),
    format: zod.literal('jsonl'),
  })
  .strict()

export const executeBulkOperationJsonOutputSchema = defineJsonOutputSchema({
  name: 'ExecuteBulkOperationResult',
  schema: zod.union([ExecuteBulkOperationResultSchema, BulkOperationFileSchema]),
  definitions: {
    BulkOperation: BulkOperationSchema,
    ExecuteBulkOperationResult: ExecuteBulkOperationResultSchema,
    BulkOperationFile: BulkOperationFileSchema,
  },
})

const GetBulkOperationStatusResultSchema = BulkOperationContextSchema.extend({
  operationGid: BulkOperationGidSchema,
  operation: BulkOperationSchema.nullable(),
})
const ListBulkOperationsResultSchema = BulkOperationContextSchema.extend({
  operations: zod.array(ListedBulkOperationSchema),
  pageInfo: zod
    .object({
      hasNextPage: zod.boolean().nullable().describe('Unknown when the API result reaches the fetch limit.'),
    })
    .strict(),
})

export const bulkOperationStatusJsonOutputSchema = defineJsonOutputSchema({
  name: 'BulkOperationStatusResult',
  schema: zod.union([GetBulkOperationStatusResultSchema, ListBulkOperationsResultSchema]),
  definitions: {
    GetBulkOperationStatusResult: GetBulkOperationStatusResultSchema,
    ListBulkOperationsResult: ListBulkOperationsResultSchema,
    BulkOperation: BulkOperationSchema,
    ListedBulkOperation: ListedBulkOperationSchema,
  },
})

// Services and text presenters retain the API model; JSON presenters project the public contract.
interface BulkOperationContext {
  store?: string
  apiVersion?: string
}

export interface CancelBulkOperationResult extends BulkOperationContext {
  operation: BulkOperation | null
  userErrors: {field?: string[] | null; message: string}[]
}

export interface ExecuteBulkOperationResult extends CancelBulkOperationResult {
  watchAborted: boolean
  results?: string
}

export type BulkOperationStatusResult = BulkOperationContext &
  ({operationId: string; operation: BulkOperation | null} | {operations: Omit<BulkOperation, 'type'>[]})
