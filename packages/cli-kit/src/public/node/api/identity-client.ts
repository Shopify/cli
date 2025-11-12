/* eslint-disable jsdoc/require-jsdoc */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @nx/enforce-module-boundaries */
/* eslint-disable jsdoc/require-description */

import {USE_LOCAL_MOCKS} from './utilities.js'
import {Environment, serviceEnvironment} from '../../../private/node/context/service.js'
import {
  exchangeDeviceCodeForAccessToken,
  ExchangeScopes,
  requestAppToken,
} from '../../../private/node/session/exchange.js'
import {ApplicationToken} from '../../../private/node/session/schema.js'
import {allDefaultScopes} from '../../../private/node/session/scopes.js'
import {applicationId} from '../../../private/node/session/identity.js'
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
interface IdentityClientInterface {
  requestDeviceAuthorization(scopes: string[]): Promise<DeviceAuthorizationResponse>
  pollForDeviceAuthorization(deviceAuth: DeviceAuthorizationResponse): Promise<IdentityToken>
  exchangeAccessForApplicationTokens(
    identityToken: IdentityToken,
    scopes: ExchangeScopes,
    store?: string,
  ): ExchangeAccessTokenResponse
}

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

export class ProdIdentityClient implements IdentityClientInterface {
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
}

export class LocalIdentityClient implements IdentityClientInterface {
  async requestDeviceAuthorization(_scopes: string[]): Promise<DeviceAuthorizationResponse> {
    return {
      deviceCode: 'ABC',
      userCode: 'ABC',
      verificationUri: 'ABC',
      expiresIn: 100_000,
      verificationUriComplete: 'ABC',
      interval: 1000,
    }
  }

  pollForDeviceAuthorization(_deviceAuth: DeviceAuthorizationResponse): Promise<IdentityToken> {
    return new Promise((resolve) =>
      resolve({
        accessToken:
          'MOCK_ACCESS_TOKEN_PLACEHOLDER',
        alias: '',
        expiresAt: getFutureDate(),
        refreshToken:
          'MOCK_REFRESH_TOKEN_PLACEHOLDER',
        scopes: allDefaultScopes(),
        userId: '08978734-325e-44ce-bc65-34823a8d5180',
      }),
    )
  }

  async exchangeAccessForApplicationTokens(
    _identityToken: IdentityToken,
    _scopes: ExchangeScopes,
    _store?: string,
  ): ExchangeAccessTokenResponse {
    const fullScopeExchangeMockResult = {
      accessToken:
        'atkn_CpUCCKv108gGEMut1MgGYoYCCAESEJ_CKyOGg00Jl0q4jUVIl2IaNWh0dHBzOi8vYXBpLnNob3BpZnkuY29tL2F1dGgvb3JnYW5pemF0aW9uLmFwcHMubWFuYWdlIAwoIDokMDg5Nzg3MzQtMzI1ZS00NGNlLWJjNjUtMzQ4MjNhOGQ1MTgwQgdBY2NvdW50ShAcrqYpOnFMYJbvMxKxqLvWUlB7InN1YiI6ImU1MzgwZTAyLTMxMmEtNzQwOC01NzE4LWUwNzAxN2U5Y2Y1MiIsImlzcyI6Imh0dHBzOi8vaWRlbnRpdHkuc2hvcC5kZXYifWIQZB-PM5BPSNC2Xn8OsL1zWGoQL8D3JzdaSaa8SUwlxxQuuxJAdBzL7VX5mXwP-8A5UZPUX-vvOa-CxX4fGZp50piE2bJDNSlGZa0SsKQRTHZqyu2plR4cUsglTLy1CxEYaIKbBQ',
      expiresAt: getFutureDate(),
      scopes: allDefaultScopes(),
    }

    return {
      [applicationId('app-management')]: fullScopeExchangeMockResult,
      [applicationId('business-platform')]: fullScopeExchangeMockResult,
      [applicationId('admin')]: fullScopeExchangeMockResult,
      [applicationId('partners')]: fullScopeExchangeMockResult,
      [applicationId('storefront-renderer')]: fullScopeExchangeMockResult,
    }
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

function getFutureDate() {
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + 100)
  return futureDate
}

const ProdIC = new ProdIdentityClient()
const LocalIC = new LocalIdentityClient()

export function getIdentityClient(): IdentityClientInterface {
  const client = USE_LOCAL_MOCKS ? LocalIC : ProdIC
  return client
}
