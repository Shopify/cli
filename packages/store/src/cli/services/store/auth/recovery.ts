import {isPreviewStoreSession, type StoredStoreAppSession} from './session-store.js'
import {AbortError} from '@shopify/cli-kit/node/error'

function storeAuthCommand(store: string, scopes: string): {command: string} {
  return {command: `shopify store auth --store ${store} --scopes ${scopes}`}
}

function storeAuthCommandNextSteps(store: string, scopes: string) {
  return [[storeAuthCommand(store, scopes)]]
}

export function throwStoredStoreAuthError(store: string): never {
  throw new AbortError(
    `No stored app authentication found for ${store}.`,
    'To create stored auth for this store, run:',
    storeAuthCommandNextSteps(store, '<comma-separated-scopes>'),
  )
}

export function throwReauthenticateStoreAuthError(message: string, store: string, scopes: string): never {
  throw new AbortError(message, 'To re-authenticate, run:', storeAuthCommandNextSteps(store, scopes))
}

/**
 * Recovery error for preview-store sessions, which can't be re-authenticated through
 * the PKCE flow because they're owned by a placeholder identity. The follow-up command
 * for recreating a preview store will be wired in when `shopify store create preview`
 * lands; until then we surface a generic recovery message.
 */
export function throwReauthenticatePreviewStoreError(message: string, store: string): never {
  throw new AbortError(
    message,
    `Preview store sessions can't be refreshed automatically. Recreate the preview store to obtain a new token.`,
    [[`The preview store ${store} can no longer be reached with the stored token.`]],
  )
}

/**
 * Dispatches to the right recovery helper based on the session kind. Preview-store
 * sessions surface a distinct error because the PKCE re-auth path is not available to
 * them.
 */
export function throwReauthenticateForSession(message: string, session: StoredStoreAppSession): never {
  if (isPreviewStoreSession(session)) {
    throwReauthenticatePreviewStoreError(message, session.store)
  }
  throwReauthenticateStoreAuthError(message, session.store, session.scopes.join(','))
}

export function retryStoreAuthWithPermanentDomainError(returnedStore: string): AbortError {
  // eslint-disable-next-line @shopify/cli/no-error-factory-functions
  return new AbortError(
    'OAuth callback store does not match the requested store.',
    `Shopify returned ${returnedStore} during authentication. Re-run using the permanent store domain:`,
    storeAuthCommandNextSteps(returnedStore, '<comma-separated-scopes>'),
  )
}
