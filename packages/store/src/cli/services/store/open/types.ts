import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

export const openStoreJsonOutputSchema = defineJsonOutputSchema({
  name: 'OpenStoreResult',
  schema: zod
    .object({
      storeDomain: zod
        .string()
        .regex(/^[^.]+\.myshopify\.com$/)
        .nullable(),
      url: zod.string().url(),
      opened: zod.boolean(),
    })
    .strict(),
})

export type OpenStoreResult = InferJsonOutputSchema<typeof openStoreJsonOutputSchema>
