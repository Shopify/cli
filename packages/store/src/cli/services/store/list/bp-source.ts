import {STORE_LIST_LIMIT} from './constants.js'
import {type OrganizationStoreListEntry} from './types.js'
import {storeTypeHandle} from '../store-type.js'
import {
  ListAccessibleShops,
  type ListAccessibleShopsQuery,
} from '../../../api/graphql/business-platform-organizations/generated/list_accessible_shops.js'
import {businessPlatformOrganizationsRequestDoc} from '@shopify/cli-kit/node/api/business-platform'
import {extractHost} from '@shopify/cli-kit/common/url'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {type UnauthorizedHandler} from '@shopify/cli-kit/node/api/graphql'
import {type Organization} from '@shopify/organizations'

interface ListBusinessPlatformStoresOptions {
  token: string
  organization: Organization
  noPrompt?: boolean
}

interface BusinessPlatformStoreListResult {
  entries: OrganizationStoreListEntry[]
  // True when the selected organization had more stores than we fetched (server-side limited).
  hasMore?: boolean
}

export async function listBusinessPlatformStores(
  options: ListBusinessPlatformStoresOptions,
): Promise<BusinessPlatformStoreListResult> {
  const {entries, hasMore} = await fetchOrganizationStores(options)

  return {
    entries: entries.sort(byCreatedAtDescending),
    ...(hasMore ? {hasMore: true} : {}),
  }
}

// Fetches one server-sorted page of the selected organization's newest active stores. The page size
// is the maximum number of stores we can display, and hasMore reflects whether more stores exist
// beyond it.
async function fetchOrganizationStores(
  options: ListBusinessPlatformStoresOptions,
): Promise<{entries: OrganizationStoreListEntry[]; hasMore: boolean}> {
  const unauthorizedHandler: UnauthorizedHandler = {
    type: 'token_refresh',
    handler: async () => ({token: await ensureAuthenticatedBusinessPlatform([], {noPrompt: options.noPrompt})}),
  }

  const result = await businessPlatformOrganizationsRequestDoc({
    query: ListAccessibleShops,
    token: options.token,
    organizationId: options.organization.id,
    variables: {first: STORE_LIST_LIMIT},
    unauthorizedHandler,
  })

  const accessibleShops = result.organization?.accessibleShops
  if (!accessibleShops) return {entries: [], hasMore: false}

  const entries: OrganizationStoreListEntry[] = []
  for (const edge of accessibleShops.edges) {
    const entry = toStoreListEntry(edge.node, options.organization)
    if (entry) entries.push(entry)
  }

  return {entries, hasMore: accessibleShops.pageInfo.hasNextPage}
}

type ShopNode = NonNullable<
  NonNullable<NonNullable<ListAccessibleShopsQuery['organization']>['accessibleShops']>['edges'][number]['node']
>

function toStoreListEntry(node: ShopNode, organization: Organization): OrganizationStoreListEntry | undefined {
  const store = node.url ?? node.primaryDomain
  if (!store) return undefined

  return {
    // Build the Shop GID from the numeric shopifyShopId (matches `store info`'s admin GID).
    // Note: the node's `externalId`/`id` are encoded BP GIDs, not the bare shop id.
    ...(node.shopifyShopId ? {id: `gid://shopify/Shop/${node.shopifyShopId}`} : {}),
    // Canonicalize the host from the BP-returned URL/domain. Do not run it through the user-input
    // normalizer (normalizeStoreFqdn), which would append `.myshopify.com` to custom domains.
    store: extractHost(store) ?? store,
    createdAt: typeof node.createdAt === 'string' ? node.createdAt : String(node.createdAt),
    organizationId: organization.id,
    organizationName: organization.businessName,
    name: node.name,
    type: storeTypeHandle(node.storeType),
  }
}

function byCreatedAtDescending(left: OrganizationStoreListEntry, right: OrganizationStoreListEntry): number {
  if (left.createdAt === right.createdAt) return left.store.localeCompare(right.store)
  return right.createdAt.localeCompare(left.createdAt)
}
