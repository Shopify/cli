import {MinimalOrganizationApp, Organization, OrganizationApp, OrganizationStore} from '../../models/organization.js'
import {
  AllAppExtensionRegistrationsQuery,
  AllAppExtensionRegistrationsQuerySchema,
} from '../../api/graphql/all_app_extension_registrations.js'
import {AllOrganizationsQuery, AllOrganizationsQuerySchema} from '../../api/graphql/all_orgs.js'
import {FindOrganizationQuery, FindOrganizationQuerySchema} from '../../api/graphql/find_org.js'
import {FindAppQuery, FindAppQuerySchema} from '../../api/graphql/find_app.js'
import {FindOrganizationBasicQuery, FindOrganizationBasicQuerySchema} from '../../api/graphql/find_org_basic.js'
import {
  AllDevStoresByOrganizationQuery,
  AllDevStoresByOrganizationSchema,
} from '../../api/graphql/all_dev_stores_by_org.js'
import {FindStoreByDomainQuery, FindStoreByDomainSchema} from '../../api/graphql/find_store_by_domain.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {AbortError} from '@shopify/cli-kit/node/error'

export const NoOrgError = (organizationId?: string) => {
  const nextSteps = [
    [
      'Have you',
      {
        link: {
          label: 'created a Shopify Partners organization',
          url: 'https://partners.shopify.com/signup',
        },
      },
      {
        char: '?',
      },
    ],
    'Have you confirmed your accounts from the emails you received?',
    [
      'Need to connect to a different App or organization? Run the command again with',
      {
        command: '--reset',
      },
    ],
  ]

  if (organizationId) {
    nextSteps.push([
      'Do you have access to the right Shopify Partners organization? The CLI is loading',
      {link: {label: 'this organization', url: `https://partner.shopify.com/${organizationId}`}},
    ])
  }

  return new AbortError(`No Organization found`, undefined, nextSteps)
}

export interface OrganizationAppsResponse {
  pageInfo: {
    hasNextPage: boolean
  }
  nodes: MinimalOrganizationApp[]
}

export interface FetchResponse {
  organization: Organization
  apps: OrganizationAppsResponse
  stores: OrganizationStore[]
}

export async function fetchAppExtensionRegistrations({
  token,
  apiKey,
}: {
  token: string
  apiKey: string
}): Promise<AllAppExtensionRegistrationsQuerySchema> {
  const query = AllAppExtensionRegistrationsQuery
  const result: AllAppExtensionRegistrationsQuerySchema = await partnersRequest(query, token, {
    apiKey,
  })
  return result
}

/**
 * Fetch all organizations the user belongs to
 * If the user doesn't belong to any org, throw an error
 * @param token - Token to access partners API
 * @returns List of organizations
 */
export async function fetchOrganizations(token: string) {
  const query = AllOrganizationsQuery
  const result: AllOrganizationsQuerySchema = await partnersRequest(query, token)
  const organizations = result.organizations.nodes
  if (organizations.length === 0) throw NoOrgError()
  return organizations
}

/**
 * Fetch all apps and stores for the given organization
 * @param orgId - Organization ID
 * @param token - Token to access partners API
 * @returns Current organization details and list of apps and stores
 */
export async function fetchOrgAndApps(orgId: string, token: string, title?: string): Promise<FetchResponse> {
  const query = FindOrganizationQuery
  const params: {id: string; title?: string} = {id: orgId}
  if (title) params.title = title
  const result: FindOrganizationQuerySchema = await partnersRequest(query, token, params)
  const org = result.organizations.nodes[0]
  if (!org) throw NoOrgError(orgId)
  const parsedOrg = {id: org.id, businessName: org.businessName}
  return {organization: parsedOrg, apps: org.apps, stores: []}
}

export async function fetchAppFromApiKey(apiKey: string, token: string): Promise<OrganizationApp | undefined> {
  const res: FindAppQuerySchema = await partnersRequest(FindAppQuery, token, {
    apiKey,
  })
  return res.app
}

export async function fetchOrgFromId(id: string, token: string): Promise<Organization> {
  const query = FindOrganizationBasicQuery
  const res: FindOrganizationBasicQuerySchema = await partnersRequest(query, token, {id})
  const org = res.organizations.nodes[0]
  if (!org) throw NoOrgError(id)
  return org
}

export async function fetchAllDevStores(orgId: string, token: string): Promise<OrganizationStore[]> {
  const query = AllDevStoresByOrganizationQuery
  const result: AllDevStoresByOrganizationSchema = await partnersRequest(query, token, {
    id: orgId,
  })
  return result.organizations.nodes[0]!.stores.nodes
}

interface FetchStoreByDomainOutput {
  organization: Organization
  store?: OrganizationStore
}
/**
 * Returns the organization and the store based on passed domain
 * If a store with that domain doesn't exist the method returns undefined
 * @param orgId - Organization ID
 * @param token - Token to access partners API
 * @param shopDomain - shop domain fqdn
 */
export async function fetchStoreByDomain(
  orgId: string,
  token: string,
  shopDomain: string,
): Promise<FetchStoreByDomainOutput | undefined> {
  const query = FindStoreByDomainQuery
  const result: FindStoreByDomainSchema = await partnersRequest(query, token, {
    id: orgId,
    shopDomain,
  })
  const org = result.organizations.nodes[0]
  if (!org) {
    return undefined
  }

  const parsedOrg = {id: org.id, businessName: org.businessName}
  const store = org.stores.nodes[0]

  return {organization: parsedOrg, store}
}
