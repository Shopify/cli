export interface StoreListEntry {
  id?: string
  store: string
  createdAt: string
  organizationId: string
  organizationName: string
  name?: string
  type?: string
}

export interface StoreListOrganization {
  id: string
  name: string
}

export interface ListStoresResult {
  stores: StoreListEntry[]
  source: 'organization'
  organization?: StoreListOrganization
  notice?: string
  truncated?: boolean
}

/**
 * The stable JSON document emitted by `store:list --json`. Its exact keys and omission rules are
 * pinned by tests. It excludes internal execution fields such as `source`.
 */
export interface StoreListDocument {
  stores: StoreListEntry[]
  organization?: StoreListOrganization
  notice?: string
  truncated?: boolean
}
