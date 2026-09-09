import {fetchOrganizations} from '../dev/fetch.js'
import {organizationGidForBP} from '../../utilities/developer-platform-client/app-management-client.js'
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const OrganizationSchema = zod.object({
  id: zod.string(),
  gid: zod.string(),
  name: zod.string(),
})

export const organizationListJsonOutputSchema = defineJsonOutputSchema({
  name: 'OrganizationListResult',
  schema: zod.object({organizations: zod.array(OrganizationSchema)}),
  definitions: {Organization: OrganizationSchema},
})

export type OrganizationListResult = InferJsonOutputSchema<typeof organizationListJsonOutputSchema>

export async function organizationList(): Promise<OrganizationListResult> {
  const organizations = await fetchOrganizations()

  return {
    organizations: organizations.map((organization) => ({
      id: organization.id,
      gid: organizationGidForBP(organization.id),
      name: organization.businessName,
    })),
  }
}
