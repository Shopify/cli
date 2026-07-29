import type {Store} from '../../api/graphql/business-platform-organizations/generated/types.js'

/**
 * Organization reference resolved from a store destination. This is intentionally minimal:
 * callers use it to address the BP Organizations API and to display the owning org.
 */
export interface StoreLookupOrganization {
  name: string
  id?: string
}

/**
 * Result of the BP Destinations lookup. The destination itself carries no fields we surface;
 * its job is to prove the store exists/is accessible and to resolve the owning org.
 */
export interface DestinationsContext {
  owningOrg?: StoreLookupOrganization
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
