import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

export const appLogSourcesJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppLogSourcesResult',
  schema: zod.array(zod.string()),
})

export type AppLogSourcesResult = InferJsonOutputSchema<typeof appLogSourcesJsonOutputSchema>
