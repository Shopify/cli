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
