import {BulkOperationGidSchema, BulkOperationSchema, BulkOperationContextSchema} from './common.js'
import {defineJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'
import type {BulkOperationContext} from './common.js'
import type {BulkOperation} from '@shopify/cli-kit/node/api/bulk-operations'

const ListedBulkOperationSchema = BulkOperationSchema.omit({type: true})

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

export type BulkOperationStatusResult = BulkOperationContext &
  ({operationId: string; operation: BulkOperation | null} | {operations: Omit<BulkOperation, 'type'>[]})

export const cancelBulkOperationJsonOutputSchema = defineJsonOutputSchema({
  name: 'CancelBulkOperationResult',
  schema: BulkOperationContextSchema.extend({status: zod.literal('success'), operation: BulkOperationSchema}),
  definitions: {BulkOperation: BulkOperationSchema},
})

export interface CancelBulkOperationResult extends BulkOperationContext {
  operation: BulkOperation | null
  userErrors: {field?: string[] | null; message: string}[]
}

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

export interface ExecuteBulkOperationResult extends CancelBulkOperationResult {
  watchAborted: boolean
  results?: string
}
