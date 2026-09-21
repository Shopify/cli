import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

export const appConfigUseJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppConfigUseResult',
  schema: zod.object({configFile: zod.string().nullable(), clientId: zod.string().nullable()}),
})

export type AppConfigUseResult = InferJsonOutputSchema<typeof appConfigUseJsonOutputSchema>
