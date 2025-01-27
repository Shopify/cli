import {Organization, OrganizationStore} from '../../models/organization.js'
import {FindStoreByDomainSchema} from '../../api/graphql/find_store_by_domain.js'
import {
  AccountInfo,
  fetchCurrentAccountInformation,
  isServiceAccount,
  isUserAccount,
} from '../context/partner-account-info.js'
import {
  DeveloperPlatformClient,
  allDeveloperPlatformClients,
  selectDeveloperPlatformClient,
} from '../../utilities/developer-platform-client.js'
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

/**
 * Fetch all organizations the user belongs to
 * If the user doesn't belong to any org, throw an error
 * @returns List of organizations
 */
export async function fetchOrganizations(): Promise<Organization[]> {
  const organizations: Organization[] = []
  for (const client of allDeveloperPlatformClients()) {
    // We don't want to run this in parallel because there could be port conflicts
    // eslint-disable-next-line no-await-in-loop
    const clientOrganizations = await client.organizations()
    organizations.push(...clientOrganizations)
  }

  if (organizations.length === 0) {
    const developerPlatformClient = selectDeveloperPlatformClient()
    const session = await developerPlatformClient.session()
    const accountInfo = await fetchCurrentAccountInformation(session.userId)
    throw new NoOrgError(accountInfo)
  }
  return organizations
}

export async function fetchOrgFromId(
  id: string,
  developerPlatformClient: DeveloperPlatformClient,
): Promise<Organization> {
  const org = await developerPlatformClient.orgFromId(id)
  if (!org) throw new NoOrgError((await developerPlatformClient.session()).accountInfo, id)
  return org
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

/**
 * Returns the store based on given domain.
 * Throws error if a store with that domain doesn't exist in the organization.
 *
 * @param org - Organization
 * @param storeFqdn - store domain fqdn
 * @param developerPlatformClient - The client to access the platform API
 */
export async function fetchStore(
  org: Organization,
  storeFqdn: string,
  developerPlatformClient: DeveloperPlatformClient,
): Promise<OrganizationStore> {
  const result: FindStoreByDomainSchema = await developerPlatformClient.storeByDomain(org.id, storeFqdn)
  const store = result.organizations.nodes[0]?.stores.nodes[0]

  if (!store) throw new AbortError(`Could not find Store for domain ${storeFqdn} in Organization ${org.businessName}.`)

  return store
}
