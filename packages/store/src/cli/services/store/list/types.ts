import {type StoreTypeFilter} from '../store-type.js'

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
  // The `--type` filter the listing was narrowed to, echoed back so output can name it.
  storeType?: StoreTypeFilter
  notice?: string
  truncated?: boolean
}
