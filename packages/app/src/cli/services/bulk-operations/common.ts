import {jsonOutputTimestampSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

export const BulkOperationGidSchema = zod
  .string()
  .regex(/^gid:\/\/shopify\/BulkOperation\/[^/]+$/)
  .describe('The Shopify global ID of a bulk operation.')

export const BulkOperationSchema = zod
  .object({
    gid: BulkOperationGidSchema,
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

export const BulkOperationContextSchema = zod
  .object({
    storeDomain: zod
      .string()
      .regex(/^[^.]+\.myshopify\.com$/)
      .nullable(),
    apiVersion: zod.string().nullable().describe('The API version selected for the request.'),
  })
  .strict()

export type BulkOperationJson = zod.infer<typeof BulkOperationSchema>
export type ListedBulkOperationJson = Omit<BulkOperationJson, 'type'>

export interface BulkOperationContext {
  store?: string
  apiVersion?: string
}
