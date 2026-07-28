import {clearStoredStoreAppSession} from './store-auth-session.js'
import {AbortError} from './error.js'
import type {LocalStorage} from './local-storage.js'
import type {StoreAuthSessionSchema, StoredStoreAppSession} from './store-auth-session.js'

const UNKNOWN_SCOPES_PLACEHOLDER = '<comma-separated-scopes>'

// HTTP statuses that mean a stored store-app session is no longer accepted, used when a caller
// doesn't name its own. 401 and 404 are the default because that is what the `store` commands have
// classified since this recovery flow was introduced. Callers whose requests can legitimately
// answer 404 for an unrelated reason - `theme push --theme <id>` against a theme that no longer
// exists - pass `[401]` instead, so a genuine not-found isn't misreported as an invalid session.
const DEFAULT_INVALID_STORE_AUTH_STATUSES: ReadonlyArray<number> = [401, 404]

function storeAuthCommandNextSteps(store: string, scopes: string, purpose: string) {
  return [['Run', {command: `shopify store auth --store ${store} --scopes ${scopes}`}, purpose]]
}

// Preview-store sessions are preapproved for a large, fixed scope catalog (often 30+ scopes).
// Suggesting the user re-request all of them encourages over-scoping, so they get the same
// placeholder as the "no stored auth" case and choose deliberately instead.
function reauthScopesFor(session: StoredStoreAppSession): string {
  return session.kind === 'preview' ? UNKNOWN_SCOPES_PLACEHOLDER : session.scopes.join(',')
}

// Two error shapes reach this module. graphql-request's `ClientError` nests the status under
// `response`, which is what escapes an Admin API call once the API version is cached, while
// cli-kit's typed transport errors (`AdminApiRequestError`, `PreviewStoreRequestError`) expose it
// directly. Both are read structurally so this module stays free of the Admin API transport's
// import graph, which every `store auth` run would otherwise pay for.
function httpStatusFromError(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined

  const {status, response} = error as {status?: unknown; response?: unknown}
  if (typeof status === 'number') return status
  if (!response || typeof response !== 'object') return undefined

  const responseStatus = (response as {status?: unknown}).status
  return typeof responseStatus === 'number' ? responseStatus : undefined
}

/**
 * Throw an actionable error reporting that no store-app authentication is stored for a store.
 *
 * @param store - The store FQDN the caller tried to use.
 * @throws AbortError pointing at `shopify store auth`.
 */
export function throwMissingStoredStoreAuthError(store: string): never {
  throw new AbortError(
    `No stored app authentication found for ${store}.`,
    undefined,
    storeAuthCommandNextSteps(store, UNKNOWN_SCOPES_PLACEHOLDER, 'to authenticate'),
  )
}

/**
 * Throw a caller-supplied message alongside the next step for re-authenticating a stored session.
 *
 * @param message - The message describing why the stored session can no longer be used.
 * @param session - The stored store auth session that needs re-authenticating.
 * @throws AbortError pointing at `shopify store auth`.
 */
export function throwReauthenticateStoreAuthError(message: string, session: StoredStoreAppSession): never {
  throw new AbortError(
    message,
    undefined,
    storeAuthCommandNextSteps(session.store, reauthScopesFor(session), 'to re-authenticate'),
  )
}

/**
 * Throw an actionable error reporting that a stored store-app session is no longer valid.
 *
 * A preview store's local session has no way to know it was claimed through the browser claim
 * flow; a rejected request the first time the stale session is used again is the only signal.
 * Surfacing that possibility is more useful than the generic "no longer valid" message a standard
 * session gets, so every call site that detects an invalid stored session (regardless of which API
 * it hit) should go through here instead of writing its own message.
 *
 * @param session - The stored store auth session that is no longer valid.
 * @throws AbortError pointing at `shopify store auth`.
 */
export function throwStoredStoreAuthInvalidError(session: StoredStoreAppSession): never {
  const message =
    session.kind === 'preview'
      ? `The preview store ${session.store} has likely been claimed, so its stored authentication is no longer valid.`
      : `Stored app authentication for ${session.store} is no longer valid.`

  throwReauthenticateStoreAuthError(message, session)
}

interface InvalidStoredStoreAuthOptions {
  /** HTTP statuses that mean the stored session is invalid. Defaults to 401 and 404. */
  invalidStatuses?: ReadonlyArray<number>
  /** Storage override for tests. */
  storage?: LocalStorage<StoreAuthSessionSchema>
}

/**
 * Convert a failed request into an actionable re-authentication error when its HTTP status means
 * the stored store-app session behind it stopped being accepted.
 *
 * The status is read from either shape a rejected Admin API request arrives in: carried directly on
 * the error (cli-kit's typed transport errors) or nested under `response` (graphql-request's
 * `ClientError`). When it matches, the stored session is cleared from local storage and an
 * `AbortError` pointing at `shopify store auth` is thrown. An error carrying any other status - or
 * no status at all - is left untouched for the caller to classify.
 *
 * @param error - The error thrown by the request made with the stored session.
 * @param session - The stored store auth session the request was made with.
 * @param options - Statuses to classify as invalid, and a storage override for tests.
 * @throws AbortError pointing at `shopify store auth` when the stored session is invalid.
 */
export function throwIfStoredStoreAuthIsInvalid(
  error: unknown,
  session: StoredStoreAppSession,
  options: InvalidStoredStoreAuthOptions = {},
): void {
  const invalidStatuses = options.invalidStatuses ?? DEFAULT_INVALID_STORE_AUTH_STATUSES
  const status = httpStatusFromError(error)
  if (status === undefined || !invalidStatuses.includes(status)) return

  // Preview sessions are cleared too, reversing the deliberate retention this flow shipped with.
  // The stored record is what blocks the recovery this function points at: `throwIfPreviewStore`
  // (`packages/store/src/cli/services/store/auth/index.ts`) aborts `store auth` for any store that
  // still has a stored preview session, so retaining it turns the printed next step into a dead
  // end. Clearing is irreversible - `store create preview` writes preview credentials once,
  // straight from the creation response, with no `expiresAt` and no `refreshToken` - but that is
  // also why nothing usable is discarded: a preview token never expires, so a status that lands
  // here means the credentials stopped being accepted outright (claimed or revoked).
  clearStoredStoreAppSession(session.store, session.userId, options.storage)

  throwStoredStoreAuthInvalidError(session)
}
