import type {Store} from '../../../api/graphql/business-platform-organizations/generated/types.js'

export interface StoreInfoStoreOwner {
  name?: string
  email?: string
}

/**
 * Internal-only org reference used to drive the BP Organizations request and to
 * populate `organizationId` / `organizationName`.
 */
export interface OwningOrgInternal {
  name: string
  id?: string
}

export interface StoreInfoResult {
  id?: string
  displayName?: string
  subdomain: string
  organizationId?: string
  organizationName?: string
  storeOwner?: StoreInfoStoreOwner
  type?: string
  // Public plan handle (basic | grow | advanced | plus), mapped from the raw BP plan name.
  // Unrecognized plans are omitted. See `plan.ts`.
  plan?: string
  featurePreview?: string
  adminUrl?: string
}

/**
 * Result of the BP Destinations lookup. The destination itself carries no fields we surface;
 * its only job is to prove the store exists/is accessible and to resolve the owning org.
 */
export interface DestinationsContext {
  owningOrg?: OwningOrgInternal
}

export interface OrganizationShopFields {
  shopifyShopId?: string
  name?: string
  primaryDomain?: string
  storeType?: Store
  developerPreviewHandle?: string
  planName?: string
  ownerName?: string
  ownerEmail?: string
}
