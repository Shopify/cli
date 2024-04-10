import {MinimalOrganizationApp, Organization, OrganizationApp, OrganizationStore} from '../../models/organization.js'

import {FindOrganizationQuery, FindOrganizationQuerySchema} from '../../api/graphql/find_org.js'
import {FindAppQuery, FindAppQuerySchema} from '../../api/graphql/find_app.js'
import {FindAppPreviewModeSchema} from '../../api/graphql/find_app_preview_mode.js'
import {
  AllDevStoresByOrganizationQuery,
  AllDevStoresByOrganizationSchema,
} from '../../api/graphql/all_dev_stores_by_org.js'
import {FindStoreByDomainSchema} from '../../api/graphql/find_store_by_domain.js'
import {AccountInfo, PartnersSession, isServiceAccount, isUserAccount} from '../context/partner-account-info.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
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

interface OrganizationAppsResponse {
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

/**
 * Fetch all organizations the user belongs to
 * If the user doesn't belong to any org, throw an error
 * @param developerPlatformClient - The client to access the platform API
 * @returns List of organizations
 */
export async function fetchOrganizations(developerPlatformClient: DeveloperPlatformClient): Promise<Organization[]> {
  const organizations: Organization[] = await developerPlatformClient.organizations()
  if (organizations.length === 0) throw new NoOrgError(await developerPlatformClient.accountInfo())
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
  const appsWithOrg = org.apps.nodes.map((app) => ({...app, organizationId: org.id}))
  return {organization: parsedOrg, apps: {...org.apps, nodes: appsWithOrg}, stores: []}
}

export enum Flag {
  DeclarativeWebhooks,
}

const FlagMap: {[key: string]: Flag} = {
  '5b25141b': Flag.DeclarativeWebhooks,
}

export async function fetchAppDetailsFromApiKey(apiKey: string, token: string): Promise<OrganizationApp | undefined> {
  const res: FindAppQuerySchema = await partnersRequest(FindAppQuery, token, {
    apiKey,
  })
  const app = res.app
  if (app) {
    const flags = filterDisabledFlags(app.disabledFlags)
    return {...app, flags}
  }
}

export function filterDisabledFlags(disabledFlags: string[] = []): Flag[] {
  const defaultActiveFlags: Flag[] = [Flag.DeclarativeWebhooks]
  const remoteDisabledFlags = disabledFlags.map((flag) => FlagMap[flag])
  return defaultActiveFlags.filter((flag) => !remoteDisabledFlags.includes(flag))
}

export async function fetchAppPreviewMode(
  apiKey: string,
  developerPlatformClient: DeveloperPlatformClient,
): Promise<boolean | undefined> {
  const res: FindAppPreviewModeSchema = await developerPlatformClient.appPreviewMode({apiKey})
  return res.app?.developmentStorePreviewEnabled
}

export async function fetchOrgFromId(
  id: string,
  developerPlatformClient: DeveloperPlatformClient,
): Promise<Organization> {
  const org = await developerPlatformClient.orgFromId(id)
  if (!org) throw new NoOrgError((await developerPlatformClient.session()).accountInfo, id)
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
 * @param shopDomain - shop domain fqdn
 * @param developerPlatformClient - The client to access the platform API
 */
export async function fetchStoreByDomain(
  orgId: string,
  shopDomain: string,
  developerPlatformClient: DeveloperPlatformClient,
): Promise<FetchStoreByDomainOutput | undefined> {
  const result: FindStoreByDomainSchema = await developerPlatformClient.storeByDomain(orgId, shopDomain)
  const org = result.organizations.nodes[0]
  if (!org) {
    return undefined
  }

  const parsedOrg = {id: org.id, businessName: org.businessName}
  const store = org.stores.nodes[0]

  return {organization: parsedOrg, store}
}
