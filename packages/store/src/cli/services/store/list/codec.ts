import {storeListJsonOutputSchema, type StoreListResult} from './types.js'

/** Encode the store:list document without selecting an output channel. */
export function encodeStoreListJson(result: StoreListResult): string {
  return JSON.stringify(storeListJsonOutputSchema.schema.parse(result), null, 2)
}
