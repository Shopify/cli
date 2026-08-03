import {type ListStoresResult, type StoreListEntry, type StoreListOrganization} from './types.js'

/** The version-one JSON document emitted by `store:list --json`. */
export interface StoreListDocument {
  stores: StoreListEntry[]
  organization?: StoreListOrganization
  notice?: string
  truncated?: boolean
}

/** Project execution data onto the stable store:list JSON contract. */
export function toStoreListDocument(result: ListStoresResult): StoreListDocument {
  return {
    stores: result.stores,
    ...(result.organization ? {organization: result.organization} : {}),
    ...(result.notice ? {notice: result.notice} : {}),
    ...(result.truncated ? {truncated: true} : {}),
  }
}

/** Encode the store:list document without selecting an output channel. */
export function encodeStoreListJson(result: ListStoresResult): string {
  return JSON.stringify(toStoreListDocument(result), null, 2)
}
