import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

export const searchJsonOutputSchema = defineJsonOutputSchema({
  name: 'SearchResult',
  schema: zod.object({url: zod.string().url()}),
})

export type SearchResult = InferJsonOutputSchema<typeof searchJsonOutputSchema>
