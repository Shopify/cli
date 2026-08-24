import {clearStoredStoreAppSession} from './store-auth-session.js'
import {AbortError} from './error.js'
import type {LocalStorage} from './local-storage.js'
import type {StoreAuthSessionSchema, StoredStoreAppSession} from './store-auth-session.js'

const UNKNOWN_SCOPES_PLACEHOLDER = '<comma-separated-scopes>'
// Only 401 always means rejected credentials. Callers whose 404 also signals a
// removed store or token must opt in with explicit statuses.
const DEFAULT_INVALID_STORE_AUTH_STATUSES: ReadonlyArray<number> = [401]

function storeAuthCommandNextSteps(store: string, scopes: string, purpose: string) {
  return [['Run', {command: `shopify store auth --store ${store} --scopes ${scopes}`}, purpose]]
}

function reauthScopesFor(session: StoredStoreAppSession): string {
  return session.kind === 'preview' ? UNKNOWN_SCOPES_PLACEHOLDER : session.scopes.join(',')
}

// API errors can store their status on `status`, `statusCode`, or `response.status`.
function httpStatusFromError(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined

  const {status, statusCode, response} = error as {status?: unknown; statusCode?: unknown; response?: unknown}
  if (typeof status === 'number') return status
  if (typeof statusCode === 'number') return statusCode
  if (!response || typeof response !== 'object') return undefined

  const responseStatus = (response as {status?: unknown}).status
  return typeof responseStatus === 'number' ? responseStatus : undefined
}

/**
 * Throws an actionable error when no store app authentication is stored.
 *
 * @param store - The store FQDN that needs authentication.
 * @throws AbortError with a `store auth` next step.
 */
export function throwMissingStoredStoreAuthError(store: string): never {
  throw new AbortError(
    `No stored app authentication found for ${store}.`,
    undefined,
    storeAuthCommandNextSteps(store, UNKNOWN_SCOPES_PLACEHOLDER, 'to authenticate'),
  )
}

/**
 * Throws an actionable error that directs the user to re-authenticate a stored session.
 *
 * @param message - The reason that the stored session cannot be used.
 * @param session - The stored session to authenticate again.
 * @throws AbortError with a `store auth` next step.
 */
export function throwReauthenticateStoreAuthError(message: string, session: StoredStoreAppSession): never {
  throw new AbortError(
    message,
    undefined,
    storeAuthCommandNextSteps(session.store, reauthScopesFor(session), 'to re-authenticate'),
  )
}

/**
 * Throws the invalid-session error for a stored store app session.
 *
 * @param session - The stored session rejected by Shopify.
 * @throws AbortError with a `store auth` next step.
 */
export function throwStoredStoreAuthInvalidError(session: StoredStoreAppSession): never {
  const message =
    session.kind === 'preview'
      ? `The preview store ${session.store} has likely been claimed, so its stored authentication is no longer valid.`
      : `Stored app authentication for ${session.store} is no longer valid.`

  throwReauthenticateStoreAuthError(message, session)
}

interface InvalidStoredStoreAuthOptions {
  invalidStatuses?: ReadonlyArray<number>
  storage?: LocalStorage<StoreAuthSessionSchema>
}

/**
 * Clears and reports a rejected stored session when its HTTP status is invalid for the caller.
 *
 * @param error - The rejected API error.
 * @param session - The stored session used for the request.
 * @param options - Statuses to classify and an optional storage override.
 * @throws AbortError with a `store auth` next step when the session is invalid.
 */
export function throwIfStoredStoreAuthIsInvalid(
  error: unknown,
  session: StoredStoreAppSession,
  options: InvalidStoredStoreAuthOptions = {},
): void {
  const invalidStatuses = options.invalidStatuses ?? DEFAULT_INVALID_STORE_AUTH_STATUSES
  const status = httpStatusFromError(error)
  if (status === undefined || !invalidStatuses.includes(status)) return

  if (options.storage) {
    clearStoredStoreAppSession(session.store, session.userId, options.storage)
  } else {
    clearStoredStoreAppSession(session.store, session.userId)
  }

  throwStoredStoreAuthInvalidError(session)
}
