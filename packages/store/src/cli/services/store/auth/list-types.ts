import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const StoreAuthListSessionSchema = zod.object({
  subdomain: zod.string(),
  connected: zod.string(),
})

export const storeAuthListJsonOutputSchema = defineJsonOutputSchema({
  name: 'StoreAuthListResult',
  schema: zod.object({
    sessions: zod.array(StoreAuthListSessionSchema),
    message: zod.string().optional(),
  }),
  definitions: {StoreAuthListSession: StoreAuthListSessionSchema},
})

export type StoreAuthListResult = InferJsonOutputSchema<typeof storeAuthListJsonOutputSchema>
