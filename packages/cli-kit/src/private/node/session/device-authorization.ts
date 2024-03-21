import {clientId} from './identity.js'
import {exchangeDeviceCodeForAccessToken} from './exchange.js'
import {IdentityToken} from './schema.js'
import {identityFqdn} from '../../../public/node/context/fqdn.js'
import {shopifyFetch} from '../../../public/node/http.js'
import {outputContent, outputDebug, outputInfo, outputToken} from '../../../public/node/output.js'
import {BugError} from '../../../public/node/error.js'

export interface DeviceAuthorizationResponse {
  deviceCode: string
  userCode: string
  verificationUri: string
  expiresIn: number
  verificationUriComplete?: string
  interval?: number
}

/**
 * Initiate a device authorization flow.
 * This will return a DeviceAuthorizationResponse containing the URL where user
 * should go to authorize the device without the need of a callback to the CLI.
 *
 * Also returns a `deviceCode` used for polling the token endpoint in the next step.
 *
 * @param scopes - The scopes to request
 * @returns An object with the device authorization response.
 */
export async function requestDeviceAuthorization(scopes: string[]): Promise<DeviceAuthorizationResponse> {
  const fqdn = await identityFqdn()
  const identityClientId = await clientId()
  const queryParams = {client_id: identityClientId, scope: scopes.join(' ')}
  const url = `https://${fqdn}/oauth/device_authorization`

  const response = await shopifyFetch(url, {
    method: 'POST',
    headers: {'Content-type': 'application/x-www-form-urlencoded'},
    body: convertRequestToParams(queryParams),
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonResult: any = await response.json()

  outputDebug(outputContent`Received device authorization code: ${outputToken.json(jsonResult)}`)
  if (!jsonResult.device_code || !jsonResult.verification_uri_complete) {
    throw new BugError('Failed to start authorization process')
  }

  outputInfo('\nTo run this command, log in to Shopify.')
  outputInfo(outputContent`User verification code: ${jsonResult.user_code}`)
  outputInfo(
    outputContent`👉 Open this link to start the auth process: ${outputToken.green(
      jsonResult.verification_uri_complete,
    )}`,
  )

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
 * @param code - The device code obtained after starting a device identity flow
 * @param interval - The interval to poll the token endpoint
 * @returns The identity token
 */
export async function pollForDeviceAuthorization(code: string, interval = 5): Promise<IdentityToken> {
  let currentIntervalInSeconds = interval

  return new Promise<IdentityToken>((resolve, reject) => {
    const onPoll = async () => {
      const result = await exchangeDeviceCodeForAccessToken(code)
      if (!result.isErr()) return resolve(result.value)

      const error = result.error ?? 'unknown_failure'

      outputDebug(outputContent`Polling for device authorization... status: ${error}`)
      switch (error) {
        case 'authorization_pending':
          return startPolling()
        case 'slow_down':
          currentIntervalInSeconds += 5
          return startPolling()
        case 'access_denied':
        case 'expired_token':
        case 'unknown_failure':
          return reject(result)
      }
    }

    const startPolling = () => {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      setTimeout(onPoll, currentIntervalInSeconds * 1000)
    }

    startPolling()
  })
}

function convertRequestToParams(queryParams: {client_id: string; scope: string}): string {
  return Object.entries(queryParams)
    .map(([key, value]) => value && `${key}=${value}`)
    .filter((hasValue) => Boolean(hasValue))
    .join('&')
}
