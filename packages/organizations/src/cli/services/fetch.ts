import {ListOrganizations} from '../api/graphql/business-platform-destinations/generated/organizations.js'
import {Organization} from '../models/organization.js'
import {businessPlatformRequestDoc} from '@shopify/cli-kit/node/api/business-platform'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {numericIdFromEncodedGid} from '@shopify/cli-kit/common/gid'

interface FetchOrganizationsWithAccessInfoResult {
  organizations: Organization[]
  currentUserResolved: boolean
}

export async function fetchOrganizations(): Promise<Organization[]> {
  const result = await fetchOrganizationsWithAccessInfo()
  return result.organizations
}

export async function fetchOrganizationsWithAccessInfo(
  token?: string,
): Promise<FetchOrganizationsWithAccessInfoResult> {
  const resolvedToken = token ?? (await ensureAuthenticatedBusinessPlatform())
  const unauthorizedHandler = {
    type: 'token_refresh' as const,
    handler: async () => {
      const newToken = await ensureAuthenticatedBusinessPlatform()
      return {token: newToken}
    },
  }

  const result = await businessPlatformRequestDoc({
    query: ListOrganizations,
    token: resolvedToken,
    unauthorizedHandler,
  })

  if (!result.currentUserAccount) {
    return {organizations: [], currentUserResolved: false}
  }

  const organizations = result.currentUserAccount.organizationsWithAccessToDestination.nodes.map((org) => {
    const id = numericIdFromEncodedGid(org.id)
    if (id === undefined) {
      throw new AbortError(`Failed to decode organization ID from: ${org.id}`)
    }
    return {id, businessName: org.name}
  })

  return {
    organizations,
    currentUserResolved: true,
  }
}
