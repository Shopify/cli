import type {DiagnosticEvent, SyncDiagnosticChannel} from '@shopify/diagnostics'

export interface StoreInfoDiagnosticError {
  message: string
  name?: string
  code?: string
}

/** Store-info events stay domain-owned while extending the generic, data-only event shape. */
export type StoreInfoDiagnosticEvent =
  | (DiagnosticEvent & {
      type: 'business-platform-fallback'
      level: 'debug'
      error: StoreInfoDiagnosticError
    })
  | (DiagnosticEvent & {type: 'organization-shop-lookup-skipped'; level: 'debug'})
  | (DiagnosticEvent & {
      type: 'organization-shop-lookup-failed'
      level: 'debug'
      error: StoreInfoDiagnosticError
    })

export interface StoreInfoExecutionContext {
  diagnostics: SyncDiagnosticChannel<StoreInfoDiagnosticEvent>
}

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
