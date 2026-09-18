import {storeTypeFilters, type StoreTypeFilter} from '../store-type.js'
import {StoreSchema, StoreOrganizationSchema} from '../types.js'
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const StoreListEntrySchema = StoreSchema.pick({
  id: true,
  name: true,
  type: true,
  plan: true,
  organizationId: true,
  organizationName: true,
})
  .partial({id: true, name: true})
  .extend({
    store: StoreSchema.shape.subdomain,
    primaryDomain: zod.string().optional().describe('The primary storefront hostname, which may be a custom domain.'),
    createdAt: zod.string(),
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
