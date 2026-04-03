import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {outputContent, outputDebug, outputToken} from '@shopify/cli-kit/node/output'
import {getCurrentStoredStoreAppSession} from './session-store.js'
import {loadStoredStoreSession} from './session-lifecycle.js'
import {fetchCurrentStoreAuthScopes} from './token-client.js'

export interface ResolvedStoreAuthScopes {
  scopes: string[]
  authoritative: boolean
}

function truncateDebugMessage(message: string, length = 300): string {
  return message.slice(0, length)
}

function formatStoreScopeLookupError(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as {response?: {status?: number; errors?: unknown}}).response
    const status = response?.status
    const details = response?.errors

    if (typeof status === 'number') {
      const summary = typeof details === 'string' ? details : JSON.stringify(details)
      return truncateDebugMessage(summary ? `HTTP ${status}: ${summary}` : `HTTP ${status}`)
    }
  }

  return truncateDebugMessage(error instanceof Error ? error.message : String(error))
}

export async function resolveExistingStoreAuthScopes(store: string): Promise<ResolvedStoreAuthScopes> {
  const normalizedStore = normalizeStoreFqdn(store)
  const storedSession = getCurrentStoredStoreAppSession(normalizedStore)
  if (!storedSession) return {scopes: [], authoritative: true}

  try {
    const usableSession = await loadStoredStoreSession(normalizedStore)
    const remoteScopes = await fetchCurrentStoreAuthScopes({
      store: usableSession.store,
      accessToken: usableSession.accessToken,
    })

    outputDebug(
      outputContent`Resolved current remote scopes for ${outputToken.raw(normalizedStore)}: ${outputToken.raw(remoteScopes.join(',') || 'none')}`,
    )

    return {scopes: remoteScopes, authoritative: true}
  } catch (error) {
    outputDebug(
      outputContent`Falling back to locally stored scopes for ${outputToken.raw(normalizedStore)} after remote scope lookup failed: ${outputToken.raw(formatStoreScopeLookupError(error))}`,
    )
    return {scopes: storedSession.scopes, authoritative: false}
  }
}
