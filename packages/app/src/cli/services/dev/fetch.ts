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
  return api.partners
    .request<api.graphql.AllAppExtensionRegistrationsQuerySchema>(query, token, {
      apiKey,
    })
    .match(
      (result) => result,
      (err) => {
        throw err
      },
    )
}

/**
 * Fetch all organizations the user belongs to
 * If the user doesn't belong to any org, throw an error
 * @param token {string} Token to access partners API
 * @returns {Promise<Organization[]>} List of organizations
 */
export async function fetchOrganizations(token: string) {
  const query = api.graphql.AllOrganizationsQuery
  return api.partners.request<api.graphql.AllOrganizationsQuerySchema>(query, token).match(
    (result) => {
      const organizations = result.organizations.nodes
      if (organizations.length === 0) throw NoOrgError()
      return organizations
    },
    (error) => {
      throw error
    },
  )
}

/**
 * Fetch all apps and stores for the given organization
 * @param orgId {string} Organization ID
 * @param token {string} Token to access partners API
 * @returns {Promise<FetchResponse>} Current organization details and list of apps and stores
 */
export async function fetchOrgAndApps(orgId: string, token: string): Promise<FetchResponse> {
  const query = api.graphql.FindOrganizationQuery
  return api.partners.request<api.graphql.FindOrganizationQuerySchema>(query, token, {id: orgId}).match(
    (result) => {
      const org = result.organizations.nodes[0]
      if (!org) throw NoOrgError(orgId)
      const parsedOrg = {id: org.id, businessName: org.businessName, appsNext: org.appsNext}
      return {organization: parsedOrg, apps: org.apps.nodes, stores: []}
    },
    (error) => {
      throw error
    },
  )
}

export async function fetchAppFromApiKey(apiKey: string, token: string): Promise<OrganizationApp | undefined> {
  return api.partners.request<api.graphql.FindAppQuerySchema>(api.graphql.FindAppQuery, token, {apiKey}).match(
    (result) => result.app,
    (error) => {
      throw error
    },
  )
}

export async function fetchOrgFromId(id: string, token: string): Promise<Organization | undefined> {
  const query = api.graphql.FindOrganizationBasicQuery
  return api.partners.request<api.graphql.FindOrganizationBasicQuerySchema>(query, token, {id}).match(
    (result) => result.organizations.nodes[0],
    (error) => {
      throw error
    },
  )
}

export async function fetchAllStores(orgId: string, token: string): Promise<OrganizationStore[]> {
  const query = api.graphql.AllStoresByOrganizationQuery
  return api.partners.request<api.graphql.AllStoresByOrganizationSchema>(query, token, {id: orgId}).match(
    (result) => result.organizations.nodes[0].stores.nodes,
    (error) => {
      throw error
    },
  )
}

interface FetchStoreByDomainOutput {
  organization: Organization
  store?: OrganizationStore
}
/**
 * Returns the organization and the store based on passed domain
 * If a store with that domain doesn't exist the method returns undefined
 * @param orgId {string} Organization ID
 * @param token {string} Token to access partners API
 * @param shopDomain {string} shop domain fqdn
 * @returns {Promise<FetchStoreByDomainOutput | undefined>}
 */
export async function fetchStoreByDomain(
  orgId: string,
  token: string,
  shopDomain: string,
): Promise<FetchStoreByDomainOutput | undefined> {
  const query = api.graphql.FindStoreByDomainQuery
  return api.partners
    .request<api.graphql.FindStoreByDomainSchema>(query, token, {
      id: orgId,
      shopDomain,
    })
    .match(
      (result) => {
        const org = result.organizations.nodes[0]
        if (!org) {
          return undefined
        }

        const parsedOrg = {id: org.id, businessName: org.businessName, appsNext: org.appsNext}
        const store = org.stores.nodes[0]

        return {organization: parsedOrg, store}
      },
      (error) => {
        throw error
      },
    )
}
