import {loadStoredStoreSession} from './session-lifecycle.js'
import {recordStoreFqdnMetadata} from '../attribution.js'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {setLastSeenUserId} from '@shopify/cli-kit/node/session'
import type {AdminSession} from '@shopify/cli-kit/node/session'
import type {StoredStoreAppSession} from './session-store.js'

export async function loadAdminSessionFromStoreAuth(store: string): Promise<{
  adminSession: AdminSession
  session: StoredStoreAppSession
}> {
  const session = await loadStoredStoreSession(normalizeStoreFqdn(store))
  await recordStoreFqdnMetadata(session.store, true)
  setLastSeenUserId(session.userId)

  return {
    adminSession: {
      token: session.accessToken,
      storeFqdn: session.store,
    },
    session,
  }
}
