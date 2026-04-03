import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {outputContent, outputDebug, outputToken} from '@shopify/cli-kit/node/output'
import {getCurrentStoredStoreAppSession} from './session-store.js'
import {loadStoredStoreSession} from './session-lifecycle.js'
import {fetchCurrentStoreAuthScopes} from './token-client.js'

export interface ResolvedStoreAuthScopes {
  scopes: string[]
  authoritative: boolean
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
      outputContent`Falling back to locally stored scopes for ${outputToken.raw(normalizedStore)} after remote scope lookup failed: ${outputToken.raw(error instanceof Error ? error.message : String(error))}`,
    )
    return {scopes: storedSession.scopes, authoritative: false}
  }
}
