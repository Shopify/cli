import {
  defineJsonOutputSchema,
  jsonOutputStoreDomainSchema,
  type InferJsonOutputSchema,
} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

export const openStoreJsonOutputSchema = defineJsonOutputSchema({
  name: 'OpenStoreResult',
  schema: zod
    .object({
      storeDomain: jsonOutputStoreDomainSchema.nullable(),
      url: zod.string().url(),
      opened: zod.boolean(),
    })
    .strict(),
})

export type OpenStoreResult = InferJsonOutputSchema<typeof openStoreJsonOutputSchema>
