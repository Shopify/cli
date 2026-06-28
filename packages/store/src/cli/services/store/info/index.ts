import {StoreInfoBusinessPlatformStoreNotFoundError, fetchDestinationsContext} from './destinations.js'
import {fetchOrganizationShop} from './organization-shop.js'
import {mapPlanToPublicHandle} from './plan.js'
import {classifyAdminApiError, throwIfStoredStoreAuthIsInvalid} from '../admin-errors.js'
import {recordStoreFqdnMetadata} from '../attribution.js'
import {loadStoredStoreSession} from '../auth/session-lifecycle.js'
import {getCurrentStoredStoreAppSession} from '../auth/session-store.js'
import {claimPreviewStore, getPreviewStore} from '../create/preview/client.js'
import {storeTypeHandle} from '../store-type.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {adminUrl} from '@shopify/cli-kit/node/api/admin'
import {graphqlRequest} from '@shopify/cli-kit/node/api/graphql'
import {compact} from '@shopify/cli-kit/common/object'
import {extractMyshopifyHandle} from '@shopify/cli-kit/common/url'
import {setLastSeenUserId} from '@shopify/cli-kit/node/session'
import {outputDebug} from '@shopify/cli-kit/node/output'
import type {DestinationsContext, OrganizationShopFields, StoreInfoResult, StoreInfoStoreOwner} from './types.js'
import type {StoredStoreAppSession} from '../auth/session-store.js'

interface GetStoreInfoOptions {
  store?: string
}

interface AdminStoreInfoResponse {
  shop?: {
    id?: string
    name?: string
    myshopifyDomain?: string
    email?: string
    shopOwnerName?: string
    plan?: {
      publicDisplayName?: string
      partnerDevelopment?: boolean
    }
  }
}

const StoreInfoAdminShopQuery = `#graphql
  query StoreInfoAdminShop {
    shop {
      id
      name
      myshopifyDomain
      email
      shopOwnerName
      plan {
        publicDisplayName
        partnerDevelopment
      }
    }
  }
`

export async function getStoreInfo(options: GetStoreInfoOptions): Promise<StoreInfoResult> {
  const store = options.store
  if (!store) {
    throw new AbortError(
      'No store specified.',
      'Pass the `myshopify.com` domain via the `--store` flag, e.g. `shopify store info --store shop.myshopify.com`.',
    )
  }

  const storedSession = getCurrentStoredStoreAppSession(store)

  if (isPreviewStoreSession(storedSession)) {
    await recordStoreFqdnMetadata(storedSession.store, true, storedSession.preview.shopId)
    const previewStoreUrls = await fetchPreviewStoreUrls(storedSession)
    return buildPreviewStoreResult({
      store,
      previewSession: storedSession,
      previewStoreUrls,
    })
  }

  const hasStoredStoreAuth = Boolean(storedSession)

  try {
    return await getBusinessPlatformStoreInfo(store, {noPrompt: hasStoredStoreAuth})
  } catch (error) {
    if (!hasStoredStoreAuth || !isBusinessPlatformFallbackError(error)) {
      throw error
    }

    outputDebug(`BP store info lookup failed; falling back to stored store auth: ${errorMessage(error)}`)
    return getAdminStoreInfo(store)
  }
}

async function getAdminStoreInfo(store: string): Promise<StoreInfoResult> {
  const session = await loadStoredStoreSession(store)
  await recordStoreFqdnMetadata(session.store, true)
  setLastSeenUserId(session.userId)
  const shop = await fetchAdminShopInfo(session)

  return buildAdminResult({store: session.store, shop})
}

async function getBusinessPlatformStoreInfo(
  store: string,
  options: {noPrompt?: boolean} = {},
): Promise<StoreInfoResult> {
  const destinationsCtx = await fetchDestinationsContext({store, noPrompt: options.noPrompt})
  const orgShop = await safeFetchOrganizationShop(destinationsCtx, store, {noPrompt: options.noPrompt})

  return buildBusinessPlatformResult({store, destinationsCtx, orgShop})
}

async function fetchAdminShopInfo(
  session: StoredStoreAppSession,
): Promise<NonNullable<AdminStoreInfoResponse['shop']>> {
  try {
    const response = await graphqlRequest<AdminStoreInfoResponse>({
      query: StoreInfoAdminShopQuery,
      api: 'Admin',
      url: adminUrl(session.store, 'unstable'),
      token: session.accessToken,
      responseOptions: {handleErrors: false},
    })

    if (!response.shop) {
      throw new AbortError(`Shopify did not return store information for ${session.store}.`)
    }

    return response.shop
  } catch (error) {
    throwIfStoredStoreAuthIsInvalid(error, session)

    const classified = classifyAdminApiError(error, session.store)
    if (classified) throw classified

    throw error
  }
}

type PreviewStoreSession = StoredStoreAppSession & {
  kind: 'preview'
  preview: NonNullable<StoredStoreAppSession['preview']>
}

function isPreviewStoreSession(session: StoredStoreAppSession | undefined): session is PreviewStoreSession {
  return session?.kind === 'preview' && session.preview !== undefined
}

interface PreviewStoreUrls {
  accessUrl: string
  saveUrl: string
}

async function fetchPreviewStoreUrls(previewSession: PreviewStoreSession): Promise<PreviewStoreUrls> {
  const request = {
    shopId: previewSession.preview.shopId,
    adminApiToken: previewSession.accessToken,
  }
  const [claim, previewStore] = await Promise.all([claimPreviewStore(request), getPreviewStore(request)])
  return {
    accessUrl: previewStore.accessUrl,
    saveUrl: claim.claimUrl,
  }
}

async function safeFetchOrganizationShop(
  ctx: DestinationsContext,
  store: string,
  options: {noPrompt?: boolean} = {},
): Promise<OrganizationShopFields | undefined> {
  if (!ctx.owningOrg?.id) {
    // Without an org id we can't address the BP Organizations API, so the shop-level fields
    // (id, owner, type, feature preview) are unavailable. The destination already gives us a
    // usable baseline (display name, admin URL).
    outputDebug('Owning organization id is unknown; skipping BP Organizations shop lookup.')
    return undefined
  }
  try {
    return await fetchOrganizationShop({store, organizationId: ctx.owningOrg.id, noPrompt: options.noPrompt})
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    outputDebug(`BP Organizations shop lookup failed: ${error instanceof Error ? error.message : String(error)}`)
    return undefined
  }
}

function isBusinessPlatformFallbackError(error: unknown): boolean {
  return error instanceof StoreInfoBusinessPlatformStoreNotFoundError || isNoPromptAuthenticationError(error)
}

function isNoPromptAuthenticationError(error: unknown): boolean {
  return error instanceof AbortError && error.message.includes('unable to prompt for reauthentication')
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

interface BuildAdminResultArgs {
  store: string
  shop: NonNullable<AdminStoreInfoResponse['shop']>
}

function buildAdminResult(args: BuildAdminResultArgs): StoreInfoResult {
  const {store, shop} = args
  const subdomain = shop.myshopifyDomain ?? store

  const fields: Partial<StoreInfoResult> = {
    id: shop.id,
    displayName: shop.name,
    storeOwner: buildAdminStoreOwner(shop),
    type: shop.plan?.partnerDevelopment ? 'dev' : undefined,
    plan: shop.plan?.publicDisplayName,
    adminUrl: buildAdminUrl(extractMyshopifyHandle(subdomain)),
  }

  return {...compact(fields), subdomain} as StoreInfoResult
}

interface BuildBusinessPlatformResultArgs {
  store: string
  destinationsCtx: DestinationsContext
  orgShop: OrganizationShopFields | undefined
}

function buildBusinessPlatformResult(args: BuildBusinessPlatformResultArgs): StoreInfoResult {
  const {store, destinationsCtx, orgShop} = args

  const fields: Partial<StoreInfoResult> = {
    id: buildShopGid(orgShop?.shopifyShopId),
    displayName: orgShop?.name,
    organizationId: destinationsCtx.owningOrg?.id,
    organizationName: destinationsCtx.owningOrg?.name,
    storeOwner: buildBusinessPlatformStoreOwner(orgShop),
    type: storeTypeHandle(orgShop?.storeType),
    plan: mapPlanToPublicHandle(orgShop?.planName),
    featurePreview: orgShop?.developerPreviewHandle,
    adminUrl: buildAdminUrl(extractMyshopifyHandle(store)),
  }

  return {...compact(fields), subdomain: store} as StoreInfoResult
}

function buildPreviewStoreResult(args: {
  store: string
  previewSession: PreviewStoreSession
  previewStoreUrls: PreviewStoreUrls
}): StoreInfoResult {
  const {store, previewSession, previewStoreUrls} = args
  // The admin URL is intentionally omitted: it doesn't resolve for an unclaimed preview store yet.
  const fields: Partial<StoreInfoResult> = {
    id: buildShopGid(previewSession.preview.shopId),
    displayName: previewSession.preview.name,
    accessUrl: previewStoreUrls.accessUrl,
    saveUrl: previewStoreUrls.saveUrl,
  }

  // `authScopes` is always present for preview stores (even when empty) so consumers can rely on the
  // key to learn which Admin API scopes are preapproved. There's no way to grant more scopes later.
  return {...compact(fields), subdomain: store, authScopes: previewSession.scopes} as StoreInfoResult
}

// The BP `ShopifyShopID` scalar is the bare numeric id; the admin GID is derived locally.
function buildShopGid(shopifyShopId: string | undefined): string | undefined {
  if (!shopifyShopId) return undefined
  return `gid://shopify/Shop/${shopifyShopId}`
}

function buildAdminStoreOwner(shop: NonNullable<AdminStoreInfoResponse['shop']>): StoreInfoStoreOwner | undefined {
  const owner = compact({name: shop.shopOwnerName, email: shop.email}) as StoreInfoStoreOwner
  return Object.keys(owner).length > 0 ? owner : undefined
}

function buildBusinessPlatformStoreOwner(orgShop: OrganizationShopFields | undefined): StoreInfoStoreOwner | undefined {
  if (!orgShop) return undefined
  const owner = compact({name: orgShop.ownerName, email: orgShop.ownerEmail}) as StoreInfoStoreOwner
  return Object.keys(owner).length > 0 ? owner : undefined
}

function buildAdminUrl(handle: string | undefined): string | undefined {
  if (!handle) return undefined
  return `https://admin.shopify.com/store/${encodeURIComponent(handle)}`
}
