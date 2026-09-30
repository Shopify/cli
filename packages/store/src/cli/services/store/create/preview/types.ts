import {StoreSchema} from '../../types.js'
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const PreviewStoreSchema = StoreSchema.pick({id: true, name: true, subdomain: true, country: true}).extend({
  storefrontUrl: zod.string(),
  type: zod.literal('preview').optional(),
  authScopes: StoreSchema.shape.authScopes.describe('Preapproved Admin API scopes for the preview store.'),
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
