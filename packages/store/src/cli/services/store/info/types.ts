import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const StoreInfoStoreOwnerSchema = zod.object({
  name: zod.string().optional(),
  email: zod.string().optional(),
})

export const storeInfoJsonOutputSchema = defineJsonOutputSchema({
  name: 'StoreInfoResult',
  schema: zod.object({
    id: zod.string().optional(),
    displayName: zod.string().optional(),
    subdomain: zod.string(),
    organizationId: zod.string().optional(),
    organizationName: zod.string().optional(),
    storeOwner: StoreInfoStoreOwnerSchema.optional(),
    type: zod.string().optional(),
    // Admin API public display name for store-auth stores, or public plan handle for BP-backed stores.
    plan: zod.string().optional(),
    featurePreview: zod.string().optional(),
    adminUrl: zod.string().optional(),
    accessUrl: zod.string().optional(),
    saveUrl: zod.string().optional(),
    // Preapproved Admin API access scopes for preview stores. Preview stores aren't a logged-in
    // experience, so there's no way to grant additional scopes later.
    authScopes: zod.array(zod.string()).optional(),
  }),
  definitions: {StoreInfoStoreOwner: StoreInfoStoreOwnerSchema},
})

export type StoreInfoStoreOwner = zod.infer<typeof StoreInfoStoreOwnerSchema>
export type StoreInfoResult = InferJsonOutputSchema<typeof storeInfoJsonOutputSchema>
