import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {isAbsolutePath} from '@shopify/cli-kit/node/path'
import {zod} from '@shopify/cli-kit/node/schema'

const graphQLResultSchema = zod
  .object({
    data: zod.record(zod.unknown()).nullable().describe('Native GraphQL query data, preserving fields and aliases.'),
    extensions: zod.record(zod.unknown()).optional().describe('Native GraphQL response extensions, when supplied.'),
  })
  .strict()

const fileReceiptSchema = zod
  .object({
    path: zod.string().refine(isAbsolutePath, 'Expected an absolute filesystem path.'),
    format: zod.literal('json'),
  })
  .strict()
  .describe('Receipt for a written JSON file containing the GraphQL result, including data and optional extensions.')

export const appExecuteJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppExecuteResult',
  schema: zod.union([graphQLResultSchema, fileReceiptSchema]),
  definitions: {AppExecuteGraphQLResult: graphQLResultSchema, AppExecuteFileReceipt: fileReceiptSchema},
})

export type AppExecuteResult = InferJsonOutputSchema<typeof appExecuteJsonOutputSchema>

export type ExecuteOperationResult =
  | {status: 'success'; result: Extract<AppExecuteResult, {data: unknown}>}
  | {status: 'failed'; details: {errors?: unknown; extensions?: unknown; data?: unknown}}
