/* eslint-disable jsdoc/require-jsdoc */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @nx/enforce-module-boundaries */
/* eslint-disable jsdoc/require-description */

import {USE_LOCAL_MOCKS} from './utilities.js'
import {
  buildIdentityToken,
  exchangeDeviceCodeForAccessToken,
  ExchangeScopes,
  requestAppToken,
  tokenRequest,
  tokenRequestErrorHandler,
} from '../../../private/node/session/exchange.js'
import {ApplicationToken} from '../../../private/node/session/schema.js'
import {allDefaultScopes} from '../../../private/node/session/scopes.js'
import {applicationId} from '../../../private/node/session/identity.js'
import {Environment, serviceEnvironment} from '../../../private/node/context/service.js'
import {identityFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {shopifyFetch} from '@shopify/cli-kit/node/http'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import {outputContent, outputDebug, outputInfo, outputToken} from '@shopify/cli-kit/node/output'
import {isCI, openURL} from '@shopify/cli-kit/node/system'
import {isCloudEnvironment} from '@shopify/cli-kit/node/context/local'
import {isTTY, keypress} from '@shopify/cli-kit/node/ui'

import {zod} from '@shopify/cli-kit/node/schema'

const DateSchema = zod.preprocess((arg: any) => {
  if (typeof arg === 'string' || arg instanceof Date) return new Date(arg)
  return null
}, zod.date())

/**
 * The schema represents an Identity token.
 */
const IdentityTokenSchema = zod.object({
  accessToken: zod.string(),
  refreshToken: zod.string(),
  expiresAt: DateSchema,
  scopes: zod.array(zod.string()),
  userId: zod.string(),
  alias: zod.string().optional(),
})
export type IdentityToken = zod.infer<typeof IdentityTokenSchema>

export interface DeviceAuthorizationResponse {
  deviceCode: string
  userCode: string
  verificationUri: string
  expiresIn: number
  verificationUriComplete?: string
  interval?: number
}

type ExchangeAccessTokenResponse = Promise<{[x: string]: ApplicationToken}>

//
/**
 * @returns Something.
 */
export function clientId(): string {
  const environment = serviceEnvironment()
  if (environment === Environment.Local) {
    return 'e5380e02-312a-7408-5718-e07017e9cf52'
  } else if (environment === Environment.Production) {
    return 'fbdb2649-e327-4907-8f67-908d24cfd7e3'
  } else {
    return 'e5380e02-312a-7408-5718-e07017e9cf52'
  }
}

abstract class IdentityClient {
  authTokenPrefix: string

  constructor() {
    // atkn_
    // atkn_mock_token_
    // mtkn_
    this.authTokenPrefix = 'mtkn_'
  }

  abstract requestDeviceAuthorization(scopes: string[]): Promise<DeviceAuthorizationResponse>
  abstract pollForDeviceAuthorization(deviceAuth: DeviceAuthorizationResponse): Promise<IdentityToken>
  abstract exchangeAccessForApplicationTokens(
    identityToken: IdentityToken,
    scopes: ExchangeScopes,
    store?: string,
  ): ExchangeAccessTokenResponse

  abstract refreshAccessToken(currentToken: IdentityToken): Promise<IdentityToken>
}

export class ProdIdentityClient extends IdentityClient {
  /**
   * Initiate a device authorization flow.
   * This will return a DeviceAuthorizationResponse containing the URL where user
   * should go to authorize the device without the need of a callback to the CLI.
   *
   * Also returns a `deviceCode` used for polling the token endpoint in the next step.
   *
   * @param scopes - The scopes to request.
   * @returns An object with the device authorization response.
   */
  async requestDeviceAuthorization(scopes: string[]): Promise<DeviceAuthorizationResponse> {
    const fqdn = await identityFqdn()
    const identityClientId = clientId()
    const queryParams = {client_id: identityClientId, scope: scopes.join(' ')}
    const url = `https://${fqdn}/oauth/device_authorization`

    const response = await shopifyFetch(url, {
      method: 'POST',
      headers: {'Content-type': 'application/x-www-form-urlencoded'},
      body: convertRequestToParams(queryParams),
    })

    // First read the response body as text so we have it for debugging
    let responseText: string
    try {
      responseText = await response.text()
    } catch (error) {
      throw new BugError(
        `Failed to read response from authorization service (HTTP ${response.status}). Network or streaming error occurred.`,
        'Check your network connection and try again.',
      )
    }

    // Now try to parse the text as JSON

    let jsonResult: any
    try {
      jsonResult = JSON.parse(responseText)
    } catch {
      const errorMessage = buildAuthorizationParseErrorMessage(response as unknown as Response, responseText)
      throw new BugError(errorMessage)
    }

    outputDebug(outputContent`Received device authorization code: ${outputToken.json(jsonResult)}`)
    if (!jsonResult.device_code || !jsonResult.verification_uri_complete) {
      throw new BugError('Failed to start authorization process')
    }

    outputInfo('\nTo run this command, log in to Shopify.')

    if (isCI()) {
      throw new AbortError(
        'Authorization is required to continue, but the current environment does not support interactive prompts.',
        'To resolve this, specify credentials in your environment, or run the command in an interactive environment such as your local terminal.',
      )
    }

    outputInfo(outputContent`User verification code: ${jsonResult.user_code}`)
    const linkToken = outputToken.link(jsonResult.verification_uri_complete)

    const cloudMessage = () => {
      outputInfo(outputContent`👉 Open this link to start the auth process: ${linkToken}`)
    }

    if (isCloudEnvironment() || !isTTY()) {
      cloudMessage()
    } else {
      outputInfo('👉 Press any key to open the login page on your browser')
      await keypress()
      const opened = await openURL(jsonResult.verification_uri_complete)
      if (opened) {
        outputInfo(outputContent`Opened link to start the auth process: ${linkToken}`)
      } else {
        cloudMessage()
      }
    }

    return {
      deviceCode: jsonResult.device_code,
      userCode: jsonResult.user_code,
      verificationUri: jsonResult.verification_uri,
      expiresIn: jsonResult.expires_in,
      verificationUriComplete: jsonResult.verification_uri_complete,
      interval: jsonResult.interval,
    }
  }

  /**
   * Poll the Oauth token endpoint with the device code obtained from a DeviceAuthorizationResponse.
   * The endpoint will return `authorization_pending` until the user completes the auth flow in the browser.
   * Once the user completes the auth flow, the endpoint will return the identity token.
   *
   * Timeout for the polling is defined by the server and is around 600 seconds.
   *
   * @param deviceAuth - DeviceAuth.
   * @returns The identity token.
   */
  async pollForDeviceAuthorization(deviceAuth: DeviceAuthorizationResponse): Promise<IdentityToken> {
    let currentIntervalInSeconds = deviceAuth.interval ?? 5

    return new Promise<IdentityToken>((resolve, reject) => {
      const onPoll = async () => {
        const result = await exchangeDeviceCodeForAccessToken(deviceAuth.deviceCode)
        if (!result.isErr()) {
          resolve(result.value)
          return
        }

        const error = result.error ?? 'unknown_failure'

        outputDebug(outputContent`Polling for device authorization... status: ${error}`)
        switch (error) {
          case 'authorization_pending': {
            startPolling()
            return
          }
          case 'slow_down':
            currentIntervalInSeconds += 5
            startPolling()
            return
          case 'access_denied':
          case 'expired_token':
          case 'unknown_failure': {
            reject(new Error(`Device authorization failed: ${error}`))
          }
        }
      }

      const startPolling = () => {
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        setTimeout(onPoll, currentIntervalInSeconds * 1000)
      }

      startPolling()
    })
  }

  async exchangeAccessForApplicationTokens(
    identityToken: IdentityToken,
    scopes: ExchangeScopes,
    store?: string,
  ): ExchangeAccessTokenResponse {
    const token = identityToken.accessToken
    // 'MOCK_COMMENTED_TOKEN_PLACEHOLDER'
    // scopes ex. 'https://api.shopify.com/auth/organization.apps.manage'
    // debugger

    const [partners, storefront, businessPlatform, admin, appManagement] = await Promise.all([
      requestAppToken('partners', token, scopes.partners),
      requestAppToken('storefront-renderer', token, scopes.storefront),
      requestAppToken('business-platform', token, scopes.businessPlatform),
      store ? requestAppToken('admin', token, scopes.admin, store) : {},
      requestAppToken('app-management', token, scopes.appManagement),
    ])

    return {
      ...partners,
      ...storefront,
      ...businessPlatform,
      ...admin,
      ...appManagement,
    }
  }

  /**
   * Given an expired access token, refresh it to get a new one.
   *
   * @param currentToken - CurrentToken.
   * @returns - Identity token.
   */
  async refreshAccessToken(currentToken: IdentityToken): Promise<IdentityToken> {
    const identityClientId = clientId()
    const params = {
      grant_type: 'refresh_token',
      access_token: currentToken.accessToken,
      refresh_token: currentToken.refreshToken,
      client_id: identityClientId,
    }
    const tokenResult = await tokenRequest(params)
    const value = tokenResult.mapError(tokenRequestErrorHandler).valueOrBug()
    return buildIdentityToken(value, currentToken.userId, currentToken.alias)
  }
}

export class LocalIdentityClient extends IdentityClient {
  private readonly mockUserId = '08978734-325e-44ce-bc65-34823a8d5180'
  private readonly mockSessionId = 'df63c65c-3731-48af-a28d-72ab16a6523a'
  private readonly mockDeviceUuid = '8ba644c8-7d2f-4260-9311-86df09195ee8'

  async requestDeviceAuthorization(_scopes: string[]): Promise<DeviceAuthorizationResponse> {
    return {
      deviceCode: 'mock-device-code',
      userCode: 'ABCD-EFGH',
      verificationUri: 'https://identity.shop.dev/device',
      expiresIn: 600,
      verificationUriComplete: 'https://identity.shop.dev/device?code=ABCD-EFGH',
      interval: 5,
    }
  }

  pollForDeviceAuthorization(_deviceAuth: DeviceAuthorizationResponse): Promise<IdentityToken> {
    const now = getCurrentUnixTimestamp()
    const exp = now + 7200 // 2 hours from now
    const scopes = allDefaultScopes()

    const identityTokenPayload = {
      client_id: clientId(),
      token_type: 'SLAT',
      exp,
      iat: now,
      sub: this.mockUserId,
      iss: 'https://identity.shop.dev',
      sid: this.mockSessionId,
      auth_time: now,
      amr: ['pwd', 'device-auth'],
      device_uuid: this.mockDeviceUuid,
      scope: scopes.join(' '),
      atl: 1.0,
    }

    const refreshTokenPayload = {
      ...identityTokenPayload,
      token_use: 'refresh',
    }

    return Promise.resolve({
      accessToken: `${this.authTokenPrefix}${encodeTokenPayload(identityTokenPayload)}`,
      alias: '',
      // 1 day expiration for shorter testing cycles
      expiresAt: getFutureDate(1),
      refreshToken: `${this.authTokenPrefix}${encodeTokenPayload(refreshTokenPayload)}`,
      scopes,
      userId: this.mockUserId,
    })
  }

  async exchangeAccessForApplicationTokens(
    identityToken: IdentityToken,
    _scopes: ExchangeScopes,
    _store?: string,
  ): ExchangeAccessTokenResponse {
    const now = getCurrentUnixTimestamp()
    // 2 hours from now
    const exp = now + 7200

    outputDebug(`[LocalIdentityClient] Generating application tokens at ${new Date(now * 1000).toISOString()}`)
    outputDebug(`[LocalIdentityClient] Token expiration: ${new Date(exp * 1000).toISOString()}`)

    const generateAppToken = (appId: string, scopeArray: string[]): ApplicationToken => {
      const tokenPayload = {
        act: {
          iss: 'https://identity.shop.dev',
          sub: clientId(),
        },
        aud: appId,
        client_id: clientId(),
        exp,
        iat: now,
        iss: 'https://identity.shop.dev',
        scope: scopeArray.join(' '),
        token_type: 'SLAT', // not sure it should be this type
        sub: identityToken.userId,
        sid: this.mockSessionId,
        auth_time: now,
        amr: ['pwd', 'device-auth'],
        device_uuid: this.mockDeviceUuid,
        atl: 1.0,
      }

      return {
        accessToken: `${this.authTokenPrefix}${encodeTokenPayload(tokenPayload)}`,
        expiresAt: new Date(exp * 1000),
        scopes: scopeArray,
      }
    }

    return {
      [applicationId('app-management')]: generateAppToken(applicationId('app-management'), allDefaultScopes()),
      [applicationId('business-platform')]: generateAppToken(applicationId('business-platform'), allDefaultScopes()),
      [applicationId('admin')]: generateAppToken(applicationId('admin'), allDefaultScopes()),
      [applicationId('partners')]: generateAppToken(applicationId('partners'), allDefaultScopes()),
      [applicationId('storefront-renderer')]: generateAppToken(
        applicationId('storefront-renderer'),
        allDefaultScopes(),
      ),
    }
  }

  async refreshAccessToken(currentToken: IdentityToken): Promise<IdentityToken> {
    const now = getCurrentUnixTimestamp()
    // 2 hours from now
    const exp = now + 7200

    outputDebug(`[LocalIdentityClient] Refreshing identity token at ${new Date(now * 1000).toISOString()}`)
    outputDebug(`[LocalIdentityClient] Previous token userId: ${currentToken.userId}`)

    const identityTokenPayload = {
      client_id: clientId(),
      token_type: 'SLAT',
      exp,
      iat: now,
      sub: currentToken.userId,
      iss: 'https://identity.shop.dev',
      sid: this.mockSessionId,
      auth_time: now,
      amr: ['pwd', 'device-auth'],
      device_uuid: this.mockDeviceUuid,
      scope: currentToken.scopes.join(' '),
      atl: 1.0,
    }

    const refreshTokenPayload = {
      ...identityTokenPayload,
      token_use: 'refresh',
    }

    return Promise.resolve({
      accessToken: `${this.authTokenPrefix}${encodeTokenPayload(identityTokenPayload)}`,
      alias: currentToken.alias,
      expiresAt: getFutureDate(1),
      refreshToken: `${this.authTokenPrefix}${encodeTokenPayload(refreshTokenPayload)}`,
      scopes: currentToken.scopes,
      userId: currentToken.userId,
    })
  }
}

function convertRequestToParams(queryParams: {client_id: string; scope: string}): string {
  return Object.entries(queryParams)
    .map(([key, value]) => value && `${key}=${value}`)
    .filter((hasValue) => Boolean(hasValue))
    .join('&')
}

/**
 * Build a detailed error message for JSON parsing failures from the authorization service.
 * Provides context-specific error messages based on response status and content.
 *
 * @param response - The HTTP response object.
 * @param responseText - The raw response body text.
 * @returns Detailed error message about the failure.
 */
function buildAuthorizationParseErrorMessage(response: Response, responseText: string): string {
  // Build helpful error message based on response status and content
  let errorMessage = `Received invalid response from authorization service (HTTP ${response.status}).`

  // Add status-based context
  if (response.status >= 500) {
    errorMessage += ' The service may be experiencing issues.'
  } else if (response.status >= 400) {
    errorMessage += ' The request may be malformed or unauthorized.'
  }

  // Add content-based context (check these regardless of status)
  if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
    errorMessage += ' Received HTML instead of JSON - the service endpoint may have changed.'
  } else if (responseText.trim() === '') {
    errorMessage += ' Received empty response body.'
  } else {
    errorMessage += ' Response could not be parsed as valid JSON.'
  }

  return `${errorMessage} If this issue persists, please contact support at https://help.shopify.com`
}

function getFutureDate(daysInFuture = 100): Date {
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + daysInFuture)
  return futureDate
}

function getCurrentUnixTimestamp(): number {
  return Math.floor(Date.now() / 1000)
}

function encodeTokenPayload(payload: object): string {
  return Buffer.from(JSON.stringify(payload))
    .toString('base64')
    .replace(/[=]/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

const ProdIC = new ProdIdentityClient()
const LocalIC = new LocalIdentityClient()

export function getIdentityClient(): IdentityClient {
  const client = USE_LOCAL_MOCKS ? LocalIC : ProdIC
  return client
}
