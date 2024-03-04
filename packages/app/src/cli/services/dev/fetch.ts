import {MinimalOrganizationApp, Organization, OrganizationApp, OrganizationStore} from '../../models/organization.js'
import {
  AllAppExtensionRegistrationsQuery,
  AllAppExtensionRegistrationsQuerySchema,
} from '../../api/graphql/all_app_extension_registrations.js'
import {AllOrganizationsQuery, AllOrganizationsQuerySchema} from '../../api/graphql/all_orgs.js'
import {FindOrganizationQuery, FindOrganizationQuerySchema} from '../../api/graphql/find_org.js'
import {FindAppQuery, FindAppQuerySchema} from '../../api/graphql/find_app.js'
import {FindAppPreviewModeQuery, FindAppPreviewModeQuerySchema} from '../../api/graphql/find_app_preview_mode.js'
import {FindOrganizationBasicQuery, FindOrganizationBasicQuerySchema} from '../../api/graphql/find_org_basic.js'
import {
  AllDevStoresByOrganizationQuery,
  AllDevStoresByOrganizationSchema,
} from '../../api/graphql/all_dev_stores_by_org.js'
import {FindStoreByDomainQuery, FindStoreByDomainSchema} from '../../api/graphql/find_store_by_domain.js'
import {ActiveAppVersionQuery, ActiveAppVersionQuerySchema} from '../../api/graphql/app_active_version.js'
import {AccountInfo, PartnersSession, isServiceAccount, isUserAccount} from '../context/partner-account-info.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'

export class NoOrgError extends AbortError {
  constructor(partnersAccount: AccountInfo, organizationId?: string) {
    let accountIdentifier = 'unknown'
    let identifierMessage = (formattedIdentifier: string) => `an ${formattedIdentifier}`
    if (isServiceAccount(partnersAccount)) {
      accountIdentifier = partnersAccount.orgName
      identifierMessage = (formattedIdentifier: string) => `the ${formattedIdentifier} organization`
    } else if (isUserAccount(partnersAccount)) {
      accountIdentifier = partnersAccount.email
      identifierMessage = (formattedIdentifier: string) => `the ${formattedIdentifier} user`
    }

    const formattedIdentifier = outputContent`${outputToken.yellow(accountIdentifier)}`.value

    const nextSteps = [
      [
        `Your current active session is associated with ${identifierMessage(
          formattedIdentifier,
        )} account. To start a new session with a different account, run`,
        {command: 'shopify auth logout'},
      ],
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
      [
        'Does your account include',
        {
          subdued: 'Manage app',
        },
        'permissions?, please contact the owner of the organization to grant you access.',
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

    super(`No Organization found`, undefined, nextSteps)
  }
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

export async function fetchActiveAppVersion({
  token,
  apiKey,
}: {
  token: string
  apiKey: string
}): Promise<ActiveAppVersionQuerySchema> {
  const query = ActiveAppVersionQuery
  const result: ActiveAppVersionQuerySchema = await partnersRequest(query, token, {
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
export async function fetchOrganizations(partnersSession: PartnersSession): Promise<Organization[]> {
  const query = AllOrganizationsQuery
  const result: AllOrganizationsQuerySchema = await partnersRequest(query, partnersSession.token)
  const organizations = result.organizations.nodes
  if (organizations.length === 0) throw new NoOrgError(partnersSession.accountInfo)
  return organizations
}

/**
 * Fetch all apps and stores for the given organization
 * @param orgId - Organization ID
 * @param token - Token to access partners API
 * @returns Current organization details and list of apps and stores
 */
export async function fetchOrgAndApps(
  orgId: string,
  partnersSession: PartnersSession,
  title?: string,
): Promise<FetchResponse> {
  const query = FindOrganizationQuery
  const params: {id: string; title?: string} = {id: orgId}
  if (title) params.title = title
  const result: FindOrganizationQuerySchema = await partnersRequest(query, partnersSession.token, params)
  const org = result.organizations.nodes[0]
  if (!org) throw new NoOrgError(partnersSession.accountInfo, orgId)
  const parsedOrg = {id: org.id, businessName: org.businessName}
  return {organization: parsedOrg, apps: org.apps, stores: []}
}

export enum BetaFlag {}

const FlagMap: {[key: string]: BetaFlag} = {}

export async function fetchAppDetailsFromApiKey(apiKey: string, token: string): Promise<OrganizationApp | undefined> {
  const res: FindAppQuerySchema = await partnersRequest(FindAppQuery, token, {
    apiKey,
  })
  const app = res.app
  if (app) {
    const betas = filterDisabledBetas(app.disabledBetas)
    return {...app, betas}
  }
}

export function filterDisabledBetas(disabledBetas: string[] = []): BetaFlag[] {
  const defaultActiveBetas: BetaFlag[] = []
  const remoteDisabledFlags = disabledBetas.map((flag) => FlagMap[flag])
  return defaultActiveBetas.filter((beta) => !remoteDisabledFlags.includes(beta))
}

export async function fetchAppPreviewMode(apiKey: string, token: string): Promise<boolean | undefined> {
  const res: FindAppPreviewModeQuerySchema = await partnersRequest(FindAppPreviewModeQuery, token, {
    apiKey,
  })
  return res.app?.developmentStorePreviewEnabled
}

export async function fetchOrgFromId(id: string, partnersSession: PartnersSession): Promise<Organization> {
  const query = FindOrganizationBasicQuery
  const res: FindOrganizationBasicQuerySchema = await partnersRequest(query, partnersSession.token, {id})
  const org = res.organizations.nodes[0]
  if (!org) throw new NoOrgError(partnersSession.accountInfo, id)
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
