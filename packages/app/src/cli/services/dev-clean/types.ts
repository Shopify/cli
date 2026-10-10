import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const appSchema = zod.object({name: zod.string(), clientId: zod.string().min(1)}).strict()

export const appDevCleanJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppDevCleanResult',
  schema: zod
    .object({
      status: zod.literal('success'),
      app: appSchema,
      storeDomain: zod.string().nullable().describe('The canonical *.myshopify.com hostname, or null when unknown.'),
    })
    .strict(),
  definitions: {AppDevCleanApp: appSchema},
})

export type AppDevCleanResult = InferJsonOutputSchema<typeof appDevCleanJsonOutputSchema>

export type DevCleanResult = Omit<AppDevCleanResult, 'storeDomain'> & {storeHostname: string}
