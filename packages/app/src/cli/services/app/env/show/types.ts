import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

export const appEnvShowJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppEnvShowResult',
  schema: zod.object({
    SHOPIFY_API_KEY: zod.string(),
    SHOPIFY_API_SECRET: zod.string().optional(),
    SCOPES: zod.string(),
  }),
})

export type AppEnvShowResult = InferJsonOutputSchema<typeof appEnvShowJsonOutputSchema>
