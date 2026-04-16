import {ListOrganizations} from '../api/graphql/business-platform-destinations/generated/organizations.js'
import {Organization} from '../models/organization.js'
import {businessPlatformRequestDoc} from '@shopify/cli-kit/node/api/business-platform'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'

export async function fetchOrganizations(): Promise<Organization[]> {
  const token = await ensureAuthenticatedBusinessPlatform()
  const unauthorizedHandler = {
    type: 'token_refresh' as const,
    handler: async () => {
      const newToken = await ensureAuthenticatedBusinessPlatform()
      return {token: newToken}
    },
  }

  const result = await businessPlatformRequestDoc({
    query: ListOrganizations,
    token,
    unauthorizedHandler,
  })

  if (!result.currentUserAccount) {
    return []
  }

  const orgs = result.currentUserAccount.organizationsWithAccessToDestination.nodes
  return orgs.map((org) => ({
    id: idFromEncodedGid(org.id),
    businessName: org.name,
  }))
}

function idFromEncodedGid(gid: string): string {
  const decodedGid = Buffer.from(gid, 'base64').toString('ascii')
  const match = decodedGid.match(/\/(\d+)$/)
  if (!match) {
    throw new AbortError(`Failed to decode organization ID from: ${gid}`)
  }
  return match[1]!
}
