import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {organizationStatusValues} from '@shopify/organizations'
import {zod} from '@shopify/cli-kit/node/schema'

const OrganizationListEntrySchema = zod
  .object({
    id: zod.string(),
    gid: zod.string(),
    name: zod.string(),
    status: zod.enum(organizationStatusValues),
    shopCount: zod.number().nullable(),
    url: zod.string(),
  })
  .strict()

export const organizationListJsonOutputSchema = defineJsonOutputSchema({
  name: 'OrganizationListResult',
  schema: zod.object({organizations: zod.array(OrganizationListEntrySchema)}).strict(),
  definitions: {OrganizationListEntry: OrganizationListEntrySchema},
})

export type OrganizationListResult = InferJsonOutputSchema<typeof organizationListJsonOutputSchema>
