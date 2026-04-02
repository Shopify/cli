import {maskToken, STORE_AUTH_APP_CLIENT_ID} from './auth-config.js'
import {createStoredStoreAuthError, reauthenticateStoreAuthError} from './auth-recovery.js'
import {
  clearStoredStoreAppSession,
  getStoredStoreAppSession,
  isSessionExpired,
  setStoredStoreAppSession,
  StoredStoreAppSession,
} from './session.js'
import {fetchApiVersions} from '@shopify/cli-kit/node/api/admin'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fetch} from '@shopify/cli-kit/node/http'
import {outputContent, outputDebug, outputToken} from '@shopify/cli-kit/node/output'
import {AdminSession} from '@shopify/cli-kit/node/session'

export interface AdminStoreGraphQLContext {
  adminSession: AdminSession
  version: string
  sessionUserId: string
}

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

async function loadStoredStoreSession(store: string): Promise<StoredStoreAppSession> {
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

async function resolveApiVersion(options: {
  session: StoredStoreAppSession
  adminSession: AdminSession
  userSpecifiedVersion?: string
}): Promise<string> {
  const {session, adminSession, userSpecifiedVersion} = options

  if (userSpecifiedVersion === 'unstable') return userSpecifiedVersion

  let availableVersions
  try {
    availableVersions = await fetchApiVersions(adminSession)
  } catch (error) {
    if (
      error instanceof AbortError &&
      error.message.includes(`Error connecting to your store ${adminSession.storeFqdn}:`) &&
      /\b(?:401|404)\b/.test(error.message)
    ) {
      clearStoredStoreAppSession(session.store, session.userId)
      throw reauthenticateStoreAuthError(
        `Stored app authentication for ${session.store} is no longer valid.`,
        session.store,
        session.scopes.join(','),
      )
    }

    throw error
  }

  if (!userSpecifiedVersion) {
    const supportedVersions = availableVersions.filter((version) => version.supported).map((version) => version.handle)
    return supportedVersions.sort().reverse()[0]!
  }

  const versionList = availableVersions.map((version) => version.handle)
  if (versionList.includes(userSpecifiedVersion)) return userSpecifiedVersion

  throw new AbortError(`Invalid API version: ${userSpecifiedVersion}`, `Allowed versions: ${versionList.join(', ')}`)
}

export async function prepareAdminStoreGraphQLContext(input: {
  store: string
  userSpecifiedVersion?: string
}): Promise<AdminStoreGraphQLContext> {
  const session = await loadStoredStoreSession(input.store)
  const adminSession = {
    token: session.accessToken,
    storeFqdn: session.store,
  }
  const version = await resolveApiVersion({session, adminSession, userSpecifiedVersion: input.userSpecifiedVersion})

  return {adminSession, version, sessionUserId: session.userId}
}
