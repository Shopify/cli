import {CurrentUserAccountResponse, Organization} from './types.js'
import {CurrentUserAccountQuery} from './graphql.js'
import {businessPlatformRequest as destinationsRequest} from '@shopify/cli-kit/node/api/business-platform'
import {URL} from 'node:url'

export const fetchOrgs = async (session: string): Promise<Organization[]> => {
  const resp: CurrentUserAccountResponse = await destinationsRequest(CurrentUserAccountQuery, session)

  const orgs: Organization[] = []
  for (const org of resp.currentUserAccount.organizations.edges) {
    const shops = org.node.categories[0]!.destinations.edges.map((edge) => {
      const shop = {
        ...edge.node,
        organizationId: org.node.id,
        domain: new URL(edge.node.webUrl).hostname,
      }
      return shop
    })
    const organization: Organization = {
      id: org.node.id,
      name: org.node.name,
      shops,
    }
    orgs.push(organization)
  }
  return orgs
}
