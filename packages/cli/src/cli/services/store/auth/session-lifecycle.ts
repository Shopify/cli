import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent, outputDebug, outputToken} from '@shopify/cli-kit/node/output'
import {maskToken} from './config.js'
import {createStoredStoreAuthError, reauthenticateStoreAuthError} from './recovery.js'
import {
  clearStoredStoreAppSession,
  getCurrentStoredStoreAppSession,
  setStoredStoreAppSession,
} from './session-store.js'
import type {StoredStoreAppSession} from './session-store.js'
import {refreshStoreAccessToken} from './token-client.js'

const EXPIRY_MARGIN_MS = 4 * 60 * 1000

export function isSessionExpired(session: StoredStoreAppSession): boolean {
  if (!session.expiresAt) return false

  const expiresAtMs = new Date(session.expiresAt).getTime()
  if (Number.isNaN(expiresAtMs)) return true

  return expiresAtMs - EXPIRY_MARGIN_MS < Date.now()
}

function buildRefreshedStoredSession(
  session: StoredStoreAppSession,
  refresh: {
    accessToken: string
    refreshToken?: string
    expiresIn?: number
    refreshTokenExpiresIn?: number
  },
): StoredStoreAppSession {
  const now = Date.now()
  const expiresAt = refresh.expiresIn ? new Date(now + refresh.expiresIn * 1000).toISOString() : session.expiresAt

  return {
    ...session,
    accessToken: refresh.accessToken,
    refreshToken: refresh.refreshToken ?? session.refreshToken,
    expiresAt,
    refreshTokenExpiresAt: refresh.refreshTokenExpiresIn
      ? new Date(now + refresh.refreshTokenExpiresIn * 1000).toISOString()
      : session.refreshTokenExpiresAt,
    acquiredAt: new Date(now).toISOString(),
  }
}

export async function loadStoredStoreSession(store: string): Promise<StoredStoreAppSession> {
  let session = getCurrentStoredStoreAppSession(store)

  if (!session) {
    throw createStoredStoreAuthError(store)
  }

  outputDebug(
    outputContent`Loaded stored session for ${outputToken.raw(store)}: token=${outputToken.raw(maskToken(session.accessToken))}, expires=${outputToken.raw(session.expiresAt ?? 'unknown')}`,
  )

  if (!isSessionExpired(session)) {
    return session
  }

  if (!session.refreshToken) {
    throw reauthenticateStoreAuthError(`No refresh token stored for ${session.store}.`, session.store, session.scopes.join(','))
  }

  outputDebug(
    outputContent`Refreshing expired token for ${outputToken.raw(session.store)} (expired at ${outputToken.raw(session.expiresAt ?? 'unknown')}, refresh_token=${outputToken.raw(maskToken(session.refreshToken))})`,
  )

  const previousAccessToken = session.accessToken

  let refreshed
  try {
    refreshed = await refreshStoreAccessToken({
      store: session.store,
      refreshToken: session.refreshToken,
    })
  } catch (error) {
    clearStoredStoreAppSession(session.store, session.userId)

    if (error instanceof AbortError && error.message.startsWith(`Token refresh failed for ${session.store} (HTTP `)) {
      throw reauthenticateStoreAuthError(error.message, session.store, session.scopes.join(','))
    }

    if (error instanceof AbortError && error.message === `Token refresh returned an invalid response for ${session.store}.`) {
      throw reauthenticateStoreAuthError(error.message, session.store, session.scopes.join(','))
    }

    if (error instanceof AbortError && error.message === 'Received an invalid refresh response from Shopify.') {
      throw error
    }

    throw error
  }

  session = buildRefreshedStoredSession(session, refreshed)

  outputDebug(
    outputContent`Token refresh succeeded for ${outputToken.raw(session.store)}: ${outputToken.raw(maskToken(previousAccessToken))} → ${outputToken.raw(maskToken(session.accessToken))}, new expiry ${outputToken.raw(session.expiresAt ?? 'unknown')}`,
  )

  setStoredStoreAppSession(session)
  return session
}
