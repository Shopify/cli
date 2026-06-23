import {loadStoredStoreSession} from '../auth/session-lifecycle.js'
import {recordStoreFqdnMetadata} from '../attribution.js'
import {setLastSeenUserId} from '@shopify/cli-kit/node/session'
import type {AdminSession} from '@shopify/cli-kit/node/session'
import type {StoredStoreAppSession} from '../auth/session-store.js'

/**
 * Loads previously stored store authentication and builds an Admin API session for it.
 *
 * Run `shopify store auth` first to create stored auth for the store.
 *
 * @param store - The store domain to load stored auth for.
 * @returns The Admin session and the full stored auth session.
 */
export async function prepareBulkAdminContext(
  store: string,
): Promise<{adminSession: AdminSession; session: StoredStoreAppSession}> {
  const session = await loadStoredStoreSession(store)
  await recordStoreFqdnMetadata(session.store, true)
  setLastSeenUserId(session.userId)

  const adminSession: AdminSession = {
    token: session.accessToken,
    storeFqdn: session.store,
  }

  return {adminSession, session}
}
