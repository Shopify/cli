import {
  businessPlatformTokenRefreshHandler,
  organizationStoresRequestDoc,
} from '../../services/store/business-platform.js'
import {StoreInfoShop} from '../../api/graphql/business-platform-organizations/generated/store-info-shop.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {extractHost} from '@shopify/cli-kit/common/url'
import type {
  StoreInfoShopQuery,
  StoreInfoShopQueryVariables,
} from '../../api/graphql/business-platform-organizations/generated/store-info-shop.js'
import type {OrganizationShopFields} from './types.js'

interface FetchOrganizationShopOptions {
  store: string
  organizationId: string
  // Names the organization if the token turns out to have no access to it.
  organizationName?: string
  token?: string
  noPrompt?: boolean
}

export async function fetchOrganizationShop(options: FetchOrganizationShopOptions): Promise<OrganizationShopFields> {
  const shop = await fetchOptionalOrganizationShop(options)

  if (!shop) {
    throw new AbortError(
      `Couldn't find shop ${options.store} inside organization ${options.organizationId}.`,
      'The shop matched a global lookup but is not listed under its parent organization. This usually means the search index is stale; try again in a moment.',
    )
  }

  return shop
}

export async function fetchOptionalOrganizationShop(
  options: FetchOrganizationShopOptions,
): Promise<OrganizationShopFields | undefined> {
  const token =
    options.token ??
    (await ensureAuthenticatedBusinessPlatform([], {noPrompt: options.noPrompt, allowAutomationToken: true}))
  const unauthorizedHandler = businessPlatformTokenRefreshHandler({noPrompt: options.noPrompt})

  const organization = {id: options.organizationId, businessName: options.organizationName}
  const response = await organizationStoresRequestDoc<StoreInfoShopQuery, StoreInfoShopQueryVariables>(organization, {
    query: StoreInfoShop,
    token,
    variables: {search: options.store},
    unauthorizedHandler,
  })

  const edges = response.organization?.accessibleShops?.edges ?? []
  const lowerStore = options.store.toLowerCase()
  const matched = edges.find((edge) => extractHost(edge.node.primaryDomain) === lowerStore)?.node

  if (!matched) return undefined

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
