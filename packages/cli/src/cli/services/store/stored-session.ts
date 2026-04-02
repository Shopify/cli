import {AbortError} from '@shopify/cli-kit/node/error'
import {fetch} from '@shopify/cli-kit/node/http'
import {outputContent, outputDebug, outputToken} from '@shopify/cli-kit/node/output'
import {maskToken, STORE_AUTH_APP_CLIENT_ID} from './auth-config.js'
import {createStoredStoreAuthError, reauthenticateStoreAuthError} from './auth-recovery.js'
import {
  clearStoredStoreAppSession,
  getStoredStoreAppSession,
  isSessionExpired,
  setStoredStoreAppSession,
} from './session.js'
import type {StoredStoreAppSession} from './session.js'

async function refreshStoreToken(session: StoredStoreAppSession): Promise<StoredStoreAppSession> {
  if (!session.refreshToken) {
    throw reauthenticateStoreAuthError(`No refresh token stored for ${session.store}.`, session.store, session.scopes.join(','))
  }

  const endpoint = `https://${session.store}/admin/oauth/access_token`

  outputDebug(
    outputContent`Refreshing expired token for ${outputToken.raw(session.store)} (expired at ${outputToken.raw(session.expiresAt ?? 'unknown')}, refresh_token=${outputToken.raw(maskToken(session.refreshToken))})`,
  )

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      client_id: STORE_AUTH_APP_CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: session.refreshToken,
    }),
  })

  const body = await response.text()

  if (!response.ok) {
    outputDebug(
      outputContent`Token refresh failed with HTTP ${outputToken.raw(String(response.status))}: ${outputToken.raw(body.slice(0, 300))}`,
    )
    clearStoredStoreAppSession(session.store, session.userId)
    throw reauthenticateStoreAuthError(
      `Token refresh failed for ${session.store} (HTTP ${response.status}).`,
      session.store,
      session.scopes.join(','),
    )
  }

  let data: {access_token?: string; refresh_token?: string; expires_in?: number; refresh_token_expires_in?: number}
  try {
    data = JSON.parse(body)
  } catch {
    clearStoredStoreAppSession(session.store, session.userId)
    throw new AbortError('Received an invalid refresh response from Shopify.')
  }

  if (!data.access_token) {
    clearStoredStoreAppSession(session.store, session.userId)
    throw reauthenticateStoreAuthError(
      `Token refresh returned an invalid response for ${session.store}.`,
      session.store,
      session.scopes.join(','),
    )
  }

  const now = Date.now()
  const expiresAt = data.expires_in ? new Date(now + data.expires_in * 1000).toISOString() : session.expiresAt

  const refreshedSession: StoredStoreAppSession = {
    ...session,
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? session.refreshToken,
    expiresAt,
    refreshTokenExpiresAt: data.refresh_token_expires_in
      ? new Date(now + data.refresh_token_expires_in * 1000).toISOString()
      : session.refreshTokenExpiresAt,
    acquiredAt: new Date(now).toISOString(),
  }

  outputDebug(
    outputContent`Token refresh succeeded for ${outputToken.raw(session.store)}: ${outputToken.raw(maskToken(session.accessToken))} → ${outputToken.raw(maskToken(refreshedSession.accessToken))}, new expiry ${outputToken.raw(expiresAt ?? 'unknown')}`,
  )

  setStoredStoreAppSession(refreshedSession)
  return refreshedSession
}

export async function loadStoredStoreSession(store: string): Promise<StoredStoreAppSession> {
  let session = getStoredStoreAppSession(store)

  if (!session) {
    throw createStoredStoreAuthError(store)
  }

  outputDebug(
    outputContent`Loaded stored session for ${outputToken.raw(store)}: token=${outputToken.raw(maskToken(session.accessToken))}, expires=${outputToken.raw(session.expiresAt ?? 'unknown')}`,
  )

  if (isSessionExpired(session)) {
    session = await refreshStoreToken(session)
  }

  return session
}
