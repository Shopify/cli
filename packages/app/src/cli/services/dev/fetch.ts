import {Organization, OrganizationApp, OrganizationStore} from '../../models/organization'
import {api, error} from '@shopify/cli-kit'

const NoOrgError = () =>
  new error.Abort(
    'No Organization found',
    'You need to create a Shopify Partners organization: https://partners.shopify.com/signup ',
  )

export interface FetchResponse {
  organization: Organization
  apps: OrganizationApp[]
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
  const result: api.graphql.AllAppExtensionRegistrationsQuerySchema = await api.partners.request(query, token, {
    apiKey,
  })
  return result
}

/**
 * Fetch all organizations the user belongs to
 * If the user doesn't belong to any org, throw an error
 * @param token {string} Token to access partners API
 * @returns {Promise<Organization[]>} List of organizations
 */
export async function fetchOrganizations(token: string) {
  const query = api.graphql.AllOrganizationsQuery
  const result: api.graphql.AllOrganizationsQuerySchema = await api.partners.request(query, token)
  const organizations = result.organizations.nodes
  if (organizations.length === 0) throw NoOrgError()
  return organizations
}

/**
 * Fetch all apps and stores for the given organization
 * @param orgId {string} Organization ID
 * @param token {string} Token to access partners API
 * @returns {Promise<FetchResponse>} Current organization details and list of apps and stores
 */
export async function fetchOrgAndApps(orgId: string, token: string): Promise<FetchResponse> {
  const query = api.graphql.FindOrganizationQuery
  const result: api.graphql.FindOrganizationQuerySchema = await api.partners.request(query, token, {id: orgId})
  const org = result.organizations.nodes[0]
  if (!org) throw NoOrgError()
  const parsedOrg = {id: org.id, businessName: org.businessName, appsNext: org.appsNext}
  return {organization: parsedOrg, apps: org.apps.nodes, stores: []}
}

export async function fetchAppFromApiKey(apiKey: string, token: string): Promise<OrganizationApp> {
  const res: api.graphql.FindAppQuerySchema = await api.partners.request(api.graphql.FindAppQuery, token, {apiKey})
  return res.app
}

export async function fetchAllStores(orgId: string, token: string): Promise<OrganizationStore[]> {
  const query = api.graphql.AllStoresByOrganizationQuery
  const result: api.graphql.AllStoresByOrganizationSchema = await api.partners.request(query, token, {id: orgId})
  return result.organizations.nodes[0].stores.nodes
}
