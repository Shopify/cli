import {CurrentUserAccount} from '../../cli/api/graphql/business-platform-destinations/generated/current_user_account.js'
import {businessPlatformRequestDoc} from '@shopify/cli-kit/node/api/business-platform'
import {UnauthorizedHandler} from '@shopify/cli-kit/node/api/graphql'
import {URL} from 'node:url'
import type {CurrentUserAccountQuery} from '../../cli/api/graphql/business-platform-destinations/generated/current_user_account.js'

export interface Shop {
  id: string
  name: string
  status: string
  publicId: string
  handle?: string | null
  shortName?: string | null
  webUrl: string
  organizationId: string
  domain: string
}

export interface Organization {
  id: string
  name: string
  shops: Shop[]
}

export const fetchOrgs = async (session: string, unauthorizedHandler: UnauthorizedHandler): Promise<Organization[]> => {
  const resp = await businessPlatformRequestDoc<CurrentUserAccountQuery, {[key: string]: never}>({
    query: CurrentUserAccount,
    token: session,
    unauthorizedHandler,
  })

  const orgs: Organization[] = []
  if (!resp.currentUserAccount?.organizations?.edges) {
    return orgs
  }

  for (const org of resp.currentUserAccount.organizations.edges) {
    const categories = org.node.categories?.[0]
    if (!categories) continue
    const shops = categories.destinations.edges.map((edge) => {
      const shop: Shop = {
        id: edge.node.id as string,
        name: edge.node.name,
        status: edge.node.status,
        publicId: edge.node.publicId as string,
        handle: edge.node.handle,
        shortName: edge.node.shortName,
        webUrl: edge.node.webUrl,
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
