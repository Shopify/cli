import {StoreSchema, StoreOrganizationSchema} from '../types.js'
import {storeTypeFilters, type StoreTypeFilter} from '../store-type.js'
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const StoreListEntrySchema = zod.object({
  id: StoreSchema.shape.id.optional(),
  store: StoreSchema.shape.subdomain,
  primaryDomain: zod.string().optional().describe('The primary storefront hostname, which may be a custom domain.'),
  createdAt: zod.string(),
  organizationId: StoreSchema.shape.organizationId,
  organizationName: StoreSchema.shape.organizationName,
  name: StoreSchema.shape.name.optional(),
  type: StoreSchema.shape.type,
  plan: StoreSchema.shape.plan,
})

export const storeListJsonOutputSchema = defineJsonOutputSchema({
  name: 'StoreListResult',
  schema: zod.object({
    stores: zod.array(StoreListEntrySchema),
    organization: StoreOrganizationSchema.optional(),
    storeType: zod.enum(storeTypeFilters as [StoreTypeFilter, ...StoreTypeFilter[]]).optional(),
    notice: zod.string().optional(),
    truncated: zod.boolean().optional(),
  }),
  definitions: {
    StoreListEntry: StoreListEntrySchema,
    StoreListOrganization: StoreOrganizationSchema,
  },
})

export type StoreListEntry = zod.infer<typeof StoreListEntrySchema>
export type StoreListOrganization = zod.infer<typeof StoreOrganizationSchema>
export type StoreListResult = InferJsonOutputSchema<typeof storeListJsonOutputSchema>
