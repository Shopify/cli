import {loadStoredStoreSession} from '../auth/session-lifecycle.js'
import {recordStoreFqdnMetadata} from '../attribution.js'
import {setLastSeenUserId} from '@shopify/cli-kit/node/session'
import type {AdminSession} from '@shopify/cli-kit/node/session'

/**
 * Loads previously stored store authentication and builds an Admin API session for it.
 *
 * Run `shopify store auth` first to create stored auth for the store.
 *
 * @param store - The store domain to load stored auth for.
 * @returns The Admin session for the stored auth.
 */
export async function prepareBulkAdminContext(store: string): Promise<AdminSession> {
  const session = await loadStoredStoreSession(store)
  await recordStoreFqdnMetadata(session.store, true)
  setLastSeenUserId(session.userId)

  return {
    token: session.accessToken,
    storeFqdn: session.store,
  }
}
