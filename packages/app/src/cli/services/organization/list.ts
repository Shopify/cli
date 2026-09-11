import {type OrganizationListResult} from './list/types.js'
import {fetchOrganizations} from '../dev/fetch.js'
import {organizationGidForBP} from '../../utilities/developer-platform-client/app-management-client.js'

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
