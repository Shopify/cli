export interface StoreInfoStoreOwner {
  name?: string
  email?: string
}

export interface StoreInfoResult {
  id?: string
  displayName?: string
  subdomain: string
  organizationId?: string
  organizationName?: string
  storeOwner?: StoreInfoStoreOwner
  type?: string
  // Admin API public display name for store-auth stores, or public plan handle for BP-backed stores.
  plan?: string
  featurePreview?: string
  adminUrl?: string
  accessUrl?: string
  saveUrl?: string
  // Preapproved Admin API access scopes for the store (currently only preview stores, which
  // cache the scopes granted at creation time). Preview stores aren't a logged-in experience, so
  // there's no way to grant additional scopes later.
  authScopes?: string[]
}
