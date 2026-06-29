/*
 * Caller authentication for Flow CLI requests.
 *
 * Flow authenticates the merchant with the credentials minted by
 * `shopify store auth` (a pure-PKCE online Admin API access token), the same way
 * `shopify store execute` does — no Shopify Identity login. The merchant token is
 * used only to authenticate the caller: the Flow backend validates it against the
 * shop's Admin API and performs the actual work with its own service auth.
 */
import {loadStoredStoreSession} from '../store-auth/session-lifecycle.js'
import {clearStoredStoreAppSession} from '../store-auth/session-store.js'
import {throwReauthenticateStoreAuthError} from '../store-auth/recovery.js'
import type {StoredStoreAppSession} from '../store-auth/session-store.js'

/**
 * Loads the merchant's stored `shopify store auth` session for `store`,
 * transparently refreshing an expired access token. Throws a user-facing
 * re-authentication error if no session is stored or the refresh fails.
 */
export async function authenticateFlowStore(store: string): Promise<StoredStoreAppSession> {
  return loadStoredStoreSession(store)
}

/**
 * Handles a 401 from a Flow gateway endpoint: the stored token was rejected, so
 * clear it and prompt the merchant to re-run `shopify store auth`.
 */
export function throwFlowAuthExpired(session: StoredStoreAppSession): never {
  clearStoredStoreAppSession(session.store, session.userId)
  throwReauthenticateStoreAuthError(
    `Stored store authentication for ${session.store} is no longer valid.`,
    session.store,
    session.scopes.join(','),
  )
}
