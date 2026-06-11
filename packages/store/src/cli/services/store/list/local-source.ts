import {type StoreAuthStoreListEntry} from './types.js'
import {listStoredStoreAuthSummaries} from '../auth/index.js'

export function listLocalStores(): StoreAuthStoreListEntry[] {
  return listStoredStoreAuthSummaries()
    .map((session) => ({
      store: session.store,
      connectedAt: session.acquiredAt,
    }))
    .sort((left, right) => right.connectedAt.localeCompare(left.connectedAt))
}
