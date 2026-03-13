import {identityFqdn} from './context/fqdn.js'
import {BugError} from './error.js'
import {shopifyFetch} from './http.js'
import {clientId, applicationId} from '../../private/node/session/identity.js'
import {pollForDeviceAuthorization} from '../../private/node/session/device-authorization.js'
import {exchangeAccessForApplicationTokens, ExchangeScopes} from '../../private/node/session/exchange.js'
import {allDefaultScopes, apiScopes} from '../../private/node/session/scopes.js'
import * as sessionStore from '../../private/node/session/store.js'
import {setCurrentSessionId} from '../../private/node/conf-store.js'

import type {AdminSession} from './session.js'

export interface DeviceCodeResponse {
  deviceCode: string
  userCode: string
  verificationUri: string
  verificationUriComplete: string
  expiresIn: number
  interval: number
}

/**
 * Requests a device authorization code for MCP non-interactive auth.
 *
 * @returns The device code response with verification URL.
 */
export async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const fqdn = await identityFqdn()
  const identityClientId = clientId()
  const scopes = allDefaultScopes()
  const params = new URLSearchParams({client_id: identityClientId, scope: scopes.join(' ')}).toString()
  const url = `https://${fqdn}/oauth/device_authorization`

  const response = await shopifyFetch(url, {
    method: 'POST',
    headers: {'Content-type': 'application/x-www-form-urlencoded'},
    body: params,
  })

  const responseText = await response.text()
  let result: Record<string, unknown>
  try {
    result = JSON.parse(responseText) as Record<string, unknown>
  } catch {
    throw new BugError(`Invalid response from authorization service (HTTP ${response.status})`)
  }

  if (!result.device_code || !result.verification_uri_complete) {
    throw new BugError('Failed to start device authorization')
  }

  return {
    deviceCode: result.device_code as string,
    userCode: result.user_code as string,
    verificationUri: result.verification_uri as string,
    verificationUriComplete: result.verification_uri_complete as string,
    expiresIn: result.expires_in as number,
    interval: (result.interval as number) ?? 5,
  }
}

/**
 * Completes device authorization by polling for approval and exchanging tokens.
 *
 * @param deviceCode - The device code from requestDeviceCode.
 * @param interval - Polling interval in seconds.
 * @param storeFqdn - The normalized store FQDN.
 * @returns An admin session with token and store FQDN.
 */
export async function completeDeviceAuth(
  deviceCode: string,
  interval: number,
  storeFqdn: string,
): Promise<AdminSession> {
  const identityToken = await pollForDeviceAuthorization(deviceCode, interval)

  const exchangeScopes: ExchangeScopes = {
    admin: apiScopes('admin'),
    partners: apiScopes('partners'),
    storefront: apiScopes('storefront-renderer'),
    businessPlatform: apiScopes('business-platform'),
    appManagement: apiScopes('app-management'),
  }

  const appTokens = await exchangeAccessForApplicationTokens(identityToken, exchangeScopes, storeFqdn)

  const fqdn = await identityFqdn()
  const sessions = (await sessionStore.fetch()) ?? {}
  const newSession = {
    identity: identityToken,
    applications: appTokens,
  }

  const updatedSessions = {
    ...sessions,
    [fqdn]: {...sessions[fqdn], [identityToken.userId]: newSession},
  }
  await sessionStore.store(updatedSessions)
  setCurrentSessionId(identityToken.userId)

  const adminAppId = applicationId('admin')
  const adminKey = `${storeFqdn}-${adminAppId}`
  const adminToken = appTokens[adminKey]

  if (!adminToken) {
    throw new BugError(`No admin token received for store ${storeFqdn}`)
  }

  return {token: adminToken.accessToken, storeFqdn}
}
