import {StoreSchema} from '../types.js'
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const StoreInfoStoreOwnerSchema = zod.object({
  name: zod.string().optional(),
  email: zod.string().optional(),
})

export const storeInfoJsonOutputSchema = defineJsonOutputSchema({
  name: 'StoreInfoResult',
  schema: zod.object({
    id: StoreSchema.shape.id.optional(),
    displayName: StoreSchema.shape.name.optional(),
    subdomain: StoreSchema.shape.subdomain,
    organizationId: StoreSchema.shape.organizationId.optional(),
    organizationName: StoreSchema.shape.organizationName.optional(),
    storeOwner: StoreInfoStoreOwnerSchema.optional(),
    type: StoreSchema.shape.type,
    country: StoreSchema.shape.country.describe('The country selected when creating the preview store, if specified.'),
    // Admin API public display name for store-auth stores, or public plan handle for BP-backed stores.
    plan: StoreSchema.shape.plan,
    featurePreview: zod.string().optional(),
    adminUrl: zod.string().optional(),
    accessUrl: zod.string().optional(),
    saveUrl: zod.string().optional(),
    // Scopes from the stored session used for this lookup. Preview store scopes are preapproved
    // and cannot be expanded through authentication.
    authScopes: StoreSchema.shape.authScopes,
  }),
  definitions: {StoreInfoStoreOwner: StoreInfoStoreOwnerSchema},
})

export type StoreInfoStoreOwner = zod.infer<typeof StoreInfoStoreOwnerSchema>
export type StoreInfoResult = InferJsonOutputSchema<typeof storeInfoJsonOutputSchema>
