import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

export const storeExecuteJsonOutputSchema = defineJsonOutputSchema({
  name: 'StoreExecuteResult',
  // The caller's query owns the response fields, including aliases and nested values.
  schema: zod.record(zod.unknown()).nullable(),
})

export type StoreExecuteResult = InferJsonOutputSchema<typeof storeExecuteJsonOutputSchema>
