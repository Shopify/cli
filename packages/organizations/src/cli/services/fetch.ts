import {businessPlatformTokenRefreshHandler} from './business-platform.js'
import {FindOrganization} from '../api/graphql/business-platform-destinations/generated/find_organization.js'
import {ListOrganizations} from '../api/graphql/business-platform-destinations/generated/organizations.js'
import {Organization, OrganizationWithDetails} from '../models/organization.js'
import {businessPlatformRequestDoc} from '@shopify/cli-kit/node/api/business-platform'
import {type UnauthorizedHandler} from '@shopify/cli-kit/node/api/graphql'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {nonRandomUUID} from '@shopify/cli-kit/node/crypto'
import {AbortError} from '@shopify/cli-kit/node/error'
import {encodeGid, numericIdFromEncodedGid, numericIdFromGid} from '@shopify/cli-kit/common/gid'

interface FetchOrganizationsWithAccessInfoResult {
  organizations: Organization[]
  currentUserResolved: boolean
}

interface FetchOrganizationsWithDetailsResult {
  organizations: OrganizationWithDetails[]
  currentUserResolved: boolean
}

export async function fetchOrganizations(): Promise<OrganizationWithDetails[]> {
  const result = await fetchOrganizationsWithDetails()
  return result.organizations
}

export async function fetchOrganizationsWithAccessInfo(
  token?: string,
): Promise<FetchOrganizationsWithAccessInfoResult> {
  return fetchOrganizationsWithDetails(token)
}

/**
 * Looks up a single organization the current account belongs to, by ID.
 *
 * The lookup is unfiltered, since the schema offers no `APPS_CLI` filter for it, so it can resolve
 * an organization the account can't reach from the CLI; the org-scoped request that follows stays
 * the authority there. Its result is cached, so callers that report a miss to the user should
 * confirm it against `fetchOrganizationsWithAccessInfo` first.
 *
 * @param organizationId - Numeric organization ID, or an organization GID.
 * @param token - Business Platform token. Fetched when not provided.
 * @param unauthorizedHandler - Overrides the default token refresh.
 * @returns The organization, or undefined when the account has none with that ID.
 */
export async function fetchOrganizationById(
  organizationId: string,
  token?: string,
  unauthorizedHandler?: UnauthorizedHandler,
): Promise<Organization | undefined> {
  const resolvedToken = token ?? (await ensureAuthenticatedBusinessPlatform())

  const result = await businessPlatformRequestDoc({
    query: FindOrganization,
    token: resolvedToken,
    variables: {organizationId: encodedOrganizationGid(organizationId)},
    unauthorizedHandler: unauthorizedHandler ?? businessPlatformTokenRefreshHandler(),
    // The cache key covers only the query and variables, and the cache is shared by every account
    // on the machine, so the token that authorized the lookup is part of it — hashed, because the
    // key is persisted. A rotated token misses rather than reading another account's entry.
    cacheOptions: {cacheTTL: {hours: 6}, cacheExtraKey: nonRandomUUID(resolvedToken)},
  })

  const organization = result.currentUserAccount?.organization
  if (!organization) return undefined

  return {id: organizationId, businessName: organization.name}
}

// Business Platform destinations endpoints address organizations by a base64-encoded GID.
function encodedOrganizationGid(organizationId: string): string {
  const numericId = organizationId.startsWith('gid://') ? numericIdFromGid(organizationId) : organizationId
  if (numericId === undefined || !/^\d+$/.test(numericId)) {
    throw new AbortError(`Invalid organization ID: ${organizationId}`)
  }
  return encodeGid(`gid://organization/Organization/${numericId}`)
}

async function fetchOrganizationsWithDetails(token?: string): Promise<FetchOrganizationsWithDetailsResult> {
  const resolvedToken = token ?? (await ensureAuthenticatedBusinessPlatform())

  const result = await businessPlatformRequestDoc({
    query: ListOrganizations,
    token: resolvedToken,
    unauthorizedHandler: businessPlatformTokenRefreshHandler(),
  })

  if (!result.currentUserAccount) {
    return {organizations: [], currentUserResolved: false}
  }

  const organizations = result.currentUserAccount.organizationsWithAccessToDestination.nodes.map((org) => {
    const id = numericIdFromEncodedGid(org.id)
    if (id === undefined) {
      throw new AbortError(`Failed to decode organization ID from: ${org.id}`)
    }
    return {
      id,
      businessName: org.name,
      status: org.status,
      shopCount: org.shopCount ?? null,
      url: org.url,
    }
  })

  return {
    organizations,
    currentUserResolved: true,
  }
}
