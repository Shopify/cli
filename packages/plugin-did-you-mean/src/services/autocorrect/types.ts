import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

export const autocorrectJsonOutputSchema = defineJsonOutputSchema({
  name: 'AutocorrectResult',
  schema: zod.object({enabled: zod.boolean()}).strict(),
})

export type AutocorrectResult = InferJsonOutputSchema<typeof autocorrectJsonOutputSchema>
