import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const StoreListEntrySchema = zod.object({
  id: zod.string().optional(),
  store: zod.string(),
  createdAt: zod.string(),
  organizationId: zod.string(),
  organizationName: zod.string(),
  name: zod.string().optional(),
  type: zod.string().optional(),
})

const StoreListOrganizationSchema = zod.object({
  id: zod.string(),
  name: zod.string(),
})

export const storeListJsonOutputSchema = defineJsonOutputSchema({
  name: 'StoreListResult',
  schema: zod.object({
    stores: zod.array(StoreListEntrySchema),
    organization: StoreListOrganizationSchema.optional(),
    notice: zod.string().optional(),
    truncated: zod.boolean().optional(),
  }),
  definitions: {
    StoreListEntry: StoreListEntrySchema,
    StoreListOrganization: StoreListOrganizationSchema,
  },
})

export type StoreListEntry = zod.infer<typeof StoreListEntrySchema>
export type StoreListOrganization = zod.infer<typeof StoreListOrganizationSchema>
export type StoreListResult = InferJsonOutputSchema<typeof storeListJsonOutputSchema>
