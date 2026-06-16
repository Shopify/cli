import {throwReauthenticateStoreAuthError} from './auth/recovery.js'
import {clearStoredStoreAppSession} from './auth/session-store.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import type {StoredStoreAppSession} from './auth/session-store.js'

interface GraphQLClientErrorLike {
  response: {status?: number; errors?: unknown}
}

export function isGraphQLClientErrorLike(error: unknown): error is GraphQLClientErrorLike {
  if (!error || typeof error !== 'object' || !('response' in error)) return false
  const response = (error as {response?: unknown}).response
  return Boolean(response) && typeof response === 'object'
}

function graphQLClientErrorStatus(error: unknown): number | undefined {
  if (!isGraphQLClientErrorLike(error)) return undefined
  const status = error.response.status
  return typeof status === 'number' ? status : undefined
}

// Lower-cased substrings that Node's fetch/undici implementations use to signal an
// aborted request. cli-kit's lower-level transport (`isTransientNetworkError` in
// packages/cli-kit/src/private/node/api.ts) already recognizes 'the operation was
// aborted'; we cover that shape and add 'the user aborted a request' (the literal
// node-fetch surfaces) so a fetch that bubbles past cli-kit's retry layer is still
// classified correctly. Exported so tests reference the same source of truth as
// production.
export const ABORTED_FETCH_MESSAGE_FRAGMENTS = ['the user aborted a request', 'the operation was aborted'] as const

function isUserAbortedFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  if (error.name === 'AbortError') return true
  const message = error.message.toLowerCase()
  return ABORTED_FETCH_MESSAGE_FRAGMENTS.some((fragment) => message.includes(fragment))
}

export function classifyAdminApiError(error: unknown, storeFqdn: string): AbortError | undefined {
  // 402 Payment Required: the shop is frozen / on hold / otherwise unavailable. Store-state
  // issue, not a CLI bug.
  if (graphQLClientErrorStatus(error) === 402) {
    // eslint-disable-next-line @shopify/cli/no-error-factory-functions
    return new AbortError(
      `The store ${storeFqdn} is currently unavailable.`,
      'Check the store in the Shopify admin and try again once it is reactivated.',
    )
  }

  // User-aborted fetches (Ctrl-C, CLI-side fetch timeouts) are user-driven, not CLI bugs.
  if (isUserAbortedFetchError(error)) {
    // eslint-disable-next-line @shopify/cli/no-error-factory-functions
    return new AbortError(`Request to ${storeFqdn} was aborted before it completed.`)
  }

  return undefined
}

export function throwIfStoredStoreAuthIsInvalid(error: unknown, session: StoredStoreAppSession): void {
  const status = graphQLClientErrorStatus(error)
  if (status !== 401 && status !== 404) return

  clearStoredStoreAppSession(session.store, session.userId)
  throwReauthenticateStoreAuthError(
    `Stored app authentication for ${session.store} is no longer valid.`,
    session.store,
    session.scopes.join(','),
  )
}
