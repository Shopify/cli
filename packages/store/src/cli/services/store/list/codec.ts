import {type ListStoresResult, type StoreListDocument} from './types.js'

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
