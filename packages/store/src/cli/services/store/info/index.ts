import {fetchDestinationsContext} from './destinations.js'
import {fetchOrganizationShop} from './organization-shop.js'
import {mapPlanToPublicHandle} from './plan.js'
import {storeTypeHandle} from '../store-type.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {compact} from '@shopify/cli-kit/common/object'
import {extractMyshopifyHandle} from '@shopify/cli-kit/common/url'
import {outputDebug} from '@shopify/cli-kit/node/output'
import type {DestinationsContext, OrganizationShopFields, StoreInfoResult, StoreInfoStoreOwner} from './types.js'

interface GetStoreInfoOptions {
  store?: string
}

export async function getStoreInfo(options: GetStoreInfoOptions): Promise<StoreInfoResult> {
  const store = options.store
  if (!store) {
    throw new AbortError(
      'No store specified.',
      'Pass the `myshopify.com` domain via the `--store` flag, e.g. `shopify store info --store shop.myshopify.com`.',
    )
  }

  const destinationsCtx = await fetchDestinationsContext({store})
  const orgShop = await safeFetchOrganizationShop(destinationsCtx, store)

  return buildResult({store, destinationsCtx, orgShop})
}

async function safeFetchOrganizationShop(
  ctx: DestinationsContext,
  store: string,
): Promise<OrganizationShopFields | undefined> {
  if (!ctx.owningOrg?.id) {
    // Without an org id we can't address the BP Organizations API, so the shop-level fields
    // (id, owner, type, feature preview) are unavailable. The destination already gives us a
    // usable baseline (display name, admin URL).
    outputDebug('Owning organization id is unknown; skipping BP Organizations shop lookup.')
    return undefined
  }
  try {
    return await fetchOrganizationShop({store, organizationId: ctx.owningOrg.id})
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    outputDebug(`BP Organizations shop lookup failed: ${error instanceof Error ? error.message : String(error)}`)
    return undefined
  }
}

interface BuildResultArgs {
  store: string
  destinationsCtx: DestinationsContext
  orgShop: OrganizationShopFields | undefined
}

function buildResult(args: BuildResultArgs): StoreInfoResult {
  const {store, destinationsCtx, orgShop} = args

  const fields: Partial<StoreInfoResult> = {
    id: buildShopGid(orgShop?.shopifyShopId),
    displayName: orgShop?.name,
    organizationId: destinationsCtx.owningOrg?.id,
    organizationName: destinationsCtx.owningOrg?.name,
    storeOwner: buildStoreOwner(orgShop),
    type: storeTypeHandle(orgShop?.storeType),
    plan: mapPlanToPublicHandle(orgShop?.planName),
    featurePreview: orgShop?.developerPreviewHandle,
    adminUrl: buildAdminUrl(extractMyshopifyHandle(store)),
  }

  return {...compact(fields), subdomain: store} as StoreInfoResult
}

// The BP `ShopifyShopID` scalar is the bare numeric id; the admin GID is derived locally.
function buildShopGid(shopifyShopId: string | undefined): string | undefined {
  if (!shopifyShopId) return undefined
  return `gid://shopify/Shop/${shopifyShopId}`
}

function buildStoreOwner(orgShop: OrganizationShopFields | undefined): StoreInfoStoreOwner | undefined {
  if (!orgShop) return undefined
  const owner = compact({name: orgShop.ownerName, email: orgShop.ownerEmail}) as StoreInfoStoreOwner
  return Object.keys(owner).length > 0 ? owner : undefined
}

function buildAdminUrl(handle: string | undefined): string | undefined {
  if (!handle) return undefined
  return `https://admin.shopify.com/store/${encodeURIComponent(handle)}`
}
