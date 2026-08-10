import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

export const StoreListEntrySchema = zod.object({
  id: zod.string().optional(),
  store: zod.string(),
  createdAt: zod.string(),
  organizationId: zod.string(),
  organizationName: zod.string(),
  name: zod.string().optional(),
  type: zod.string().optional(),
})

export const StoreListOrganizationSchema = zod.object({
  id: zod.string(),
  name: zod.string(),
})

const StoreListResultSchema = zod.object({
  stores: zod.array(StoreListEntrySchema),
  organization: StoreListOrganizationSchema.optional(),
  notice: zod.string().optional(),
  truncated: zod.boolean().optional(),
})

export const storeListJsonOutputSchema = defineJsonOutputSchema({
  name: 'StoreListResult',
  schema: StoreListResultSchema,
  definitions: {
    StoreListEntry: StoreListEntrySchema,
    StoreListOrganization: StoreListOrganizationSchema,
  },
})

export type StoreListEntry = zod.infer<typeof StoreListEntrySchema>
export type StoreListOrganization = zod.infer<typeof StoreListOrganizationSchema>
export type StoreListResult = InferJsonOutputSchema<typeof storeListJsonOutputSchema>
