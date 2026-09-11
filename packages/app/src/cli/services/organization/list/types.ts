import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const OrganizationListEntrySchema = zod
  .object({
    id: zod.string(),
    gid: zod.string(),
    name: zod.string(),
  })
  .strict()

export const organizationListJsonOutputSchema = defineJsonOutputSchema({
  name: 'OrganizationListResult',
  schema: zod.object({organizations: zod.array(OrganizationListEntrySchema)}).strict(),
  definitions: {OrganizationListEntry: OrganizationListEntrySchema},
})

export type OrganizationListResult = InferJsonOutputSchema<typeof organizationListJsonOutputSchema>
