/* eslint-disable jsdoc/require-jsdoc */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @nx/enforce-module-boundaries */
/* eslint-disable jsdoc/require-description */

import {Environment, serviceEnvironment} from '../../../private/node/context/service.js'
import {err, ok, Result} from '../result.js'
import {exchangeDeviceCodeForAccessToken} from '../../../private/node/session/exchange.js'
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

interface TokenRequestResult {
  access_token: string
  expires_in: number
  refresh_token: string
  scope: string
  id_token?: string
}

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

interface TokenRequestConfig {
  [key: string]: string
}
type TokenRequestConfigResponse = Promise<Result<TokenRequestResult, {error: string; store?: string}>>
interface IdentityClientInterface {
  requestDeviceAuthorization(scopes: string[]): Promise<DeviceAuthorizationResponse>
  pollForDeviceAuthorization(deviceAuth: DeviceAuthorizationResponse): Promise<IdentityToken>
  tokenRequest(params: TokenRequestConfig): TokenRequestConfigResponse
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

  async tokenRequest(params: TokenRequestConfig): TokenRequestConfigResponse {
    const fqdn = await identityFqdn()
    const url = new URL(`https://${fqdn}/oauth/token`)
    url.search = new URLSearchParams(Object.entries(params)).toString()

    const res = await shopifyFetch(url.href, {method: 'POST'})

    const payload: any = await res.json()

    if (res.ok) return ok(payload)

    return err({error: payload.error, store: params.store})
  }
}

export class LocalIdentityClient implements IdentityClientInterface {
  async requestDeviceAuthorization(_scopes: string[]): Promise<DeviceAuthorizationResponse> {
    return {
      deviceCode: 'ABC',
      userCode: 'ABC',
      verificationUri: 'ABC',
      expiresIn: 10_000,
      verificationUriComplete: 'ABC',
      interval: 1000,
    }
  }

  // use skip_test_mode_warning in one of these token exchanges
  pollForDeviceAuthorization(_deviceAuth: DeviceAuthorizationResponse): Promise<IdentityToken> {
    return new Promise((resolve) =>
      resolve({
        accessToken: 'MOCK_ACCESS_TOKEN_2_PLACEHOLDER',
        refreshToken: 'MOCK_REFRESH_TOKEN_2_PLACEHOLDER',
        expiresAt: new Date('November 11, 2099'),
        scopes: [
          // use helper in scopes.ts for this?
          'openid',
          'https://api.shopify.com/auth/partners.app.cli.access',
          'https://api.shopify.com/auth/shop.admin.themes',
          'https://api.shopify.com/auth/partners.collaborator-relationships.readonly',
          'https://api.shopify.com/auth/shop.admin.graphql',
          'https://api.shopify.com/auth/destinations.readonly',
          'https://api.shopify.com/auth/organization.store-management',
          'https://api.shopify.com/auth/organization.on-demand-user-access',
          'https://api.shopify.com/auth/shop.storefront-renderer.devtools',
          'https://api.shopify.com/auth/organization.apps.manage',
        ],
        userId: '08978734-325e-44ce-bc65-34823a8d5180',
      }),
    )
  }

  async tokenRequest(_params: TokenRequestConfig): TokenRequestConfigResponse {
    throw new Error('Method not implemented.')

    return new Promise((resolve) =>
      resolve(
        ok({
          access_token:
            'atkn_Cp4CCMjqzsgGEOiiz8gGYo8CCAESEAvI8AcbUEq5g2Zuk75vWjMaPmh0dHBzOi8vYXBpLnNob3BpZnkuY29tL2F1dGgvc2hvcC5zdG9yZWZyb250LXJlbmRlcmVyLmRldnRvb2xzIDIoIDokMDg5Nzg3MzQtMzI1ZS00NGNlLWJjNjUtMzQ4MjNhOGQ1MTgwQgdBY2NvdW50ShC0HvgPwyJAaLrv9UsFUxQbUlB7InN1YiI6ImU1MzgwZTAyLTMxMmEtNzQwOC01NzE4LWUwNzAxN2U5Y2Y1MiIsImlzcyI6Imh0dHBzOi8vaWRlbnRpdHkuc2hvcC5kZXYifWIQ1OQu5VaTQUOTO4zG2NABO2oQbEi7u5iKQHqUTDtoYQcGCRJAof8oE4mOQVeMIybOMlurQqSqAmJXllCh3kuPQyfScccuxbwzjdzvXYGh4Ojutf9w2h7W55rPH4uZguprKoQOCA',
          refresh_token: 'xyz',
          expires_in: 7200,
          issued_token_type: 'urn:ietf:params:oauth:token-type:access_token',
          scope: 'https://api.shopify.com/auth/shop.storefront-renderer.devtools',
          token_type: 'bearer',
        }),
      ),
    )
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

// this can all be cleaned up better
const ProdIC = new ProdIdentityClient()
const LocalIC = new LocalIdentityClient()

export function getIdentityClient(): IdentityClientInterface {
  // eslint-disable-next-line @shopify/prefer-module-scope-constants
  const FORCE_NO_MOCKS = true
  const env = serviceEnvironment()
  const client = env === 'local' && !FORCE_NO_MOCKS ? LocalIC : ProdIC
  return client
}
