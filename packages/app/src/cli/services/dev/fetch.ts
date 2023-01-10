import {Organization, OrganizationApp, MinimalOrganizationApp, OrganizationStore} from '../../models/organization.js'
import {api, error} from '@shopify/cli-kit'

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
  // eslint-disable-next-line rulesdir/no-error-factory-functions
  return new error.Abort(`No Organization found`, undefined, nextSteps)
}

export interface FetchResponse {
  organization: Organization
  apps: MinimalOrganizationApp[]
  stores: OrganizationStore[]
}

export async function fetchAppExtensionRegistrations({
  token,
  apiKey,
}: {
  token: string
  apiKey: string
}): Promise<api.graphql.AllAppExtensionRegistrationsQuerySchema> {
  const query = api.graphql.AllAppExtensionRegistrationsQuery
  const result: api.graphql.AllAppExtensionRegistrationsQuerySchema = await api.partners.partnersRequest(query, token, {
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
  const query = api.graphql.AllOrganizationsQuery
  const result: api.graphql.AllOrganizationsQuerySchema = await api.partners.partnersRequest(query, token)
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
  const query = api.graphql.FindOrganizationQuery
  const params: {id: string; title?: string} = {id: orgId}
  if (title) params.title = title
  const result: api.graphql.FindOrganizationQuerySchema = await api.partners.partnersRequest(query, token, params)
  const org = result.organizations.nodes[0]
  if (!org) throw NoOrgError(orgId)
  const parsedOrg = {id: org.id, businessName: org.businessName, appsNext: org.appsNext}
  return {organization: parsedOrg, apps: org.apps.nodes, stores: []}
}

export async function fetchAppFromApiKey(apiKey: string, token: string): Promise<OrganizationApp | undefined> {
  const res: api.graphql.FindAppQuerySchema = await api.partners.partnersRequest(api.graphql.FindAppQuery, token, {
    apiKey,
  })
  return res.app
}

export async function fetchOrgFromId(id: string, token: string): Promise<Organization | undefined> {
  const query = api.graphql.FindOrganizationBasicQuery
  const res: api.graphql.FindOrganizationBasicQuerySchema = await api.partners.partnersRequest(query, token, {id})
  return res.organizations.nodes[0]
}

export async function fetchAllDevStores(orgId: string, token: string): Promise<OrganizationStore[]> {
  const query = api.graphql.AllDevStoresByOrganizationQuery
  const result: api.graphql.AllDevStoresByOrganizationSchema = await api.partners.partnersRequest(query, token, {
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
  const query = api.graphql.FindStoreByDomainQuery
  const result: api.graphql.FindStoreByDomainSchema = await api.partners.partnersRequest(query, token, {
    id: orgId,
    shopDomain,
  })
  const org = result.organizations.nodes[0]
  if (!org) {
    return undefined
  }

  const parsedOrg = {id: org.id, businessName: org.businessName, appsNext: org.appsNext}
  const store = org.stores.nodes[0]

  return {organization: parsedOrg, store}
}
