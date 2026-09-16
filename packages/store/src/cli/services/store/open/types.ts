import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

export const openStoreJsonOutputSchema = defineJsonOutputSchema({
  name: 'OpenStoreResult',
  schema: zod.object({
    store: zod.string(),
    url: zod.string(),
    opened: zod.boolean(),
  }),
})

export type OpenStoreResult = InferJsonOutputSchema<typeof openStoreJsonOutputSchema>
