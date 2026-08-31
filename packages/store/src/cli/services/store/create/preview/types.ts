import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const PreviewStoreSchema = zod.object({
  id: zod.string(),
  name: zod.string(),
  subdomain: zod.string(),
  country: zod.string().optional(),
  storefrontUrl: zod.string(),
})

export const createPreviewStoreJsonOutputSchema = defineJsonOutputSchema({
  name: 'CreatePreviewStoreResult',
  schema: zod.object({
    status: zod.literal('success'),
    message: zod.string(),
    store: PreviewStoreSchema,
    next_steps: zod.array(zod.string()),
  }),
  definitions: {PreviewStore: PreviewStoreSchema},
})

export type CreatePreviewStoreResult = InferJsonOutputSchema<typeof createPreviewStoreJsonOutputSchema>
