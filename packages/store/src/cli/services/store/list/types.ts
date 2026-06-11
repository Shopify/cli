export type StoreListRequestedSource = 'auto' | 'organization' | 'store-auth'

export interface OrganizationStoreListEntry {
  id?: string
  store: string
  createdAt: string
  organizationId: string
  organizationName: string
  name?: string
  type?: string
}

export interface StoreAuthStoreListEntry {
  store: string
  connectedAt: string
}

export interface StoreListOrganization {
  id: string
  name: string
}

interface OrganizationListStoresResult {
  source: 'organization'
  stores: OrganizationStoreListEntry[]
  organization?: StoreListOrganization
  notice?: string
  truncated?: boolean
}

interface StoreAuthListStoresResult {
  source: 'store-auth'
  stores: StoreAuthStoreListEntry[]
  notice?: string
  truncated?: boolean
}

export type ListStoresResult = OrganizationListStoresResult | StoreAuthListStoresResult
