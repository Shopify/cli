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
