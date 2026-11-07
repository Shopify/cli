import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

export const storeExecuteJsonOutputSchema = defineJsonOutputSchema({
  name: 'StoreExecuteResult',
  schema: zod
    .object({
      data: zod
        .record(zod.unknown())
        .nullable()
        .describe('GraphQL response data, preserving query fields and aliases.'),
      extensions: zod
        .record(zod.unknown())
        .optional()
        .describe('Response-level GraphQL metadata, when returned by the API.'),
    })
    .strict(),
})

export type StoreExecuteResult = InferJsonOutputSchema<typeof storeExecuteJsonOutputSchema>
