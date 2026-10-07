import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const appSchema = zod.object({name: zod.string(), clientId: zod.string().min(1)}).strict()

export const appDevCleanJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppDevCleanResult',
  schema: zod
    .object({
      status: zod.literal('success'),
      app: appSchema,
      storeDomain: zod
        .string()
        .regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/)
        .describe('The canonical store hostname, without a scheme or path.'),
    })
    .strict(),
  definitions: {AppDevCleanApp: appSchema},
})

export type AppDevCleanResult = InferJsonOutputSchema<typeof appDevCleanJsonOutputSchema>
