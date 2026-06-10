import {StoreInfoShop} from '../../../api/graphql/business-platform-organizations/generated/store-info-shop.js'
import {BugError} from '@shopify/cli-kit/node/error'
import {businessPlatformOrganizationsRequestDoc} from '@shopify/cli-kit/node/api/business-platform'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {extractHost} from '@shopify/cli-kit/common/url'
import type {
  StoreInfoShopQuery,
  StoreInfoShopQueryVariables,
} from '../../../api/graphql/business-platform-organizations/generated/store-info-shop.js'
import type {OrganizationShopFields} from './types.js'

interface FetchOrganizationShopOptions {
  store: string
  organizationId: string
  token?: string
}

export async function fetchOrganizationShop(options: FetchOrganizationShopOptions): Promise<OrganizationShopFields> {
  const token = options.token ?? (await ensureAuthenticatedBusinessPlatform())
  const unauthorizedHandler = {
    type: 'token_refresh' as const,
    handler: async () => {
      const newToken = await ensureAuthenticatedBusinessPlatform()
      return {token: newToken}
    },
  }

  const response = await businessPlatformOrganizationsRequestDoc<StoreInfoShopQuery, StoreInfoShopQueryVariables>({
    query: StoreInfoShop,
    token,
    organizationId: options.organizationId,
    variables: {search: options.store},
    unauthorizedHandler,
  })

  const edges = response.organization?.accessibleShops?.edges ?? []
  const lowerStore = options.store.toLowerCase()
  const matched = edges.map((edge) => edge.node).find((node) => extractHost(node.primaryDomain) === lowerStore)

  if (!matched) {
    throw new BugError(
      `Couldn't find shop ${options.store} inside organization ${options.organizationId}.`,
      'The shop matched a global lookup but is not listed under its parent organization. This usually means the search index is stale; try again in a moment.',
    )
  }

  return {
    shopifyShopId: matched.shopifyShopId ?? undefined,
    name: matched.name,
    primaryDomain: matched.primaryDomain ?? undefined,
    storeType: matched.storeType ?? undefined,
    developerPreviewHandle: matched.developerPreviewHandle ?? undefined,
    planName: matched.planName ?? undefined,
    ownerName: matched.ownerDetails?.fullName ?? undefined,
    ownerEmail: matched.ownerDetails?.email ?? undefined,
  }
}
