import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'
import type {BulkOperation} from '@shopify/cli-kit/node/api/bulk-operations'

const BulkOperationSchema = zod.object({
  id: zod.string(),
  type: zod.enum(['QUERY', 'MUTATION']),
  status: zod.enum(['CREATED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELED', 'CANCELING', 'EXPIRED']),
  errorCode: zod.enum(['ACCESS_DENIED', 'INTERNAL_SERVER_ERROR', 'TIMEOUT']).nullish(),
  createdAt: zod.string(),
  completedAt: zod.string().nullish(),
  objectCount: zod.union([zod.string(), zod.number()]),
  url: zod.string().nullish(),
  partialDataUrl: zod.string().nullish(),
}) satisfies zod.ZodType<BulkOperation>

// The list query selects the same fields except the operation type.
const ListedBulkOperationSchema = BulkOperationSchema.omit({type: true})
const BulkOperationUserErrorSchema = zod.object({
  field: zod.array(zod.string()).nullish(),
  message: zod.string(),
})
const BulkOperationContextSchema = zod.object({
  store: zod.string().optional(),
  apiVersion: zod.string().optional().describe('The API version selected for the request.'),
})
const BulkOperationResponseSchema = BulkOperationContextSchema.extend({
  operation: BulkOperationSchema.nullable(),
  userErrors: zod.array(BulkOperationUserErrorSchema),
})

export const cancelBulkOperationJsonOutputSchema = defineJsonOutputSchema({
  name: 'CancelBulkOperationResult',
  schema: BulkOperationResponseSchema,
  definitions: {BulkOperation: BulkOperationSchema, BulkOperationUserError: BulkOperationUserErrorSchema},
})

export const executeBulkOperationJsonOutputSchema = defineJsonOutputSchema({
  name: 'ExecuteBulkOperationResult',
  schema: BulkOperationResponseSchema.extend({
    watchAborted: zod.boolean(),
    results: zod.string().optional().describe('Downloaded results in JSONL format.'),
    outputFile: zod.string().optional().describe('The file containing the downloaded JSONL results.'),
  }),
  definitions: {BulkOperation: BulkOperationSchema, BulkOperationUserError: BulkOperationUserErrorSchema},
})

const GetBulkOperationStatusResultSchema = BulkOperationContextSchema.extend({
  operationId: zod.string(),
  operation: BulkOperationSchema.nullable(),
})
const ListBulkOperationsResultSchema = BulkOperationContextSchema.extend({
  operations: zod.array(ListedBulkOperationSchema),
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

export type CancelBulkOperationResult = InferJsonOutputSchema<typeof cancelBulkOperationJsonOutputSchema>
export type ExecuteBulkOperationResult = InferJsonOutputSchema<typeof executeBulkOperationJsonOutputSchema>
export type BulkOperationStatusResult = InferJsonOutputSchema<typeof bulkOperationStatusJsonOutputSchema>
