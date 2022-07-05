import {Organization, OrganizationApp, OrganizationStore} from '../../models/organization.js'
import {api, error, output} from '@shopify/cli-kit'

export const NoOrgError = (organizationId?: string) => {
  const nextSteps = [
    output.content`Have you ${output.token.link(
      'created a Shopify Partners organization',
      'https://partners.shopify.com/signup',
    )}?`,
    output.content`Have you confirmed your accounts from the emails you received?`,
    output.content`Need to connect to a different App or organization? Run the command again with ${output.token.genericShellCommand(
      '--reset',
    )}`,
  ]
  if (organizationId) {
    nextSteps.push(
      output.content`Do you have access to the right Shopify Partners organization? The CLI is loading ${output.token.link(
        'this organization',
        `https://partner.shopify.com/${organizationId}`,
      )}`,
    )
  }
  return new error.Abort(
    `No Organization found`,
    nextSteps.map((content) => `· ${output.stringifyMessage(content)}`).join('\n'),
  )
}

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
  if (!org) throw NoOrgError(orgId)
  const parsedOrg = {id: org.id, businessName: org.businessName, appsNext: org.appsNext}
  return {organization: parsedOrg, apps: org.apps.nodes, stores: []}
}

export async function fetchAppFromApiKey(apiKey: string, token: string): Promise<OrganizationApp | undefined> {
  const res: api.graphql.FindAppQuerySchema = await api.partners.request(api.graphql.FindAppQuery, token, {apiKey})
  return res.app
}

export async function fetchOrgFromId(id: string, token: string): Promise<Organization | undefined> {
  const query = api.graphql.FindOrganizationBasicQuery
  const res: api.graphql.FindOrganizationBasicQuerySchema = await api.partners.request(query, token, {id})
  return res.organizations.nodes[0]
}

export async function fetchAllStores(orgId: string, token: string): Promise<OrganizationStore[]> {
  const query = api.graphql.AllStoresByOrganizationQuery
  const result: api.graphql.AllStoresByOrganizationSchema = await api.partners.request(query, token, {id: orgId})
  return result.organizations.nodes[0].stores.nodes
}

export async function fetchStoresByDomain(orgId: string, token: string, shopDomain: string): Promise<OrganizationStore[]> {
  const query = api.graphql.FindStoreByDomainQuery
  const result: api.graphql.FindStoreByDomainSchema = await api.partners.request(query, token, {id: orgId, shopDomain: shopDomain})
  return result.organizations.nodes[0].stores.nodes
}
