import {clientId} from './identity.js'
import {exchangeDeviceCodeForAccessToken} from './exchange.js'
import {IdentityToken} from './schema.js'
import {identityFqdn} from '../../../public/node/context/fqdn.js'
import {shopifyFetch} from '../../../public/node/http.js'
import {outputContent, outputDebug, outputInfo, outputToken} from '../../../public/node/output.js'
import {AbortError, BugError} from '../../../public/node/error.js'
import {isCloudEnvironment} from '../../../public/node/context/local.js'
import {isCI, openURL} from '../../../public/node/system.js'
import {isTTY, keypress} from '../../../public/node/ui.js'

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
  const identityClientId = clientId()
  const queryParams = {client_id: identityClientId, scope: scopes.join(' ')}
  const url = `https://${fqdn}/oauth/device_authorization`

  const response = await shopifyFetch(url, {
    method: 'POST',
    headers: {'Content-type': 'application/x-www-form-urlencoded'},
    body: convertRequestToParams(queryParams),
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let jsonResult: any
  try {
    jsonResult = await response.json()
  } catch (error) {
    throw new BugError('Received unexpected response. This may be a service outage. Please try again later.')
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
 * @param code - The device code obtained after starting a device identity flow
 * @param interval - The interval to poll the token endpoint
 * @returns The identity token
 */
export async function pollForDeviceAuthorization(code: string, interval = 5): Promise<IdentityToken> {
  let currentIntervalInSeconds = interval

  return new Promise<IdentityToken>((resolve, reject) => {
    const onPoll = async () => {
      const result = await exchangeDeviceCodeForAccessToken(code)
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
          {
            startPolling()
            return
          }
        case 'access_denied':
        case 'expired_token':
        case 'unknown_failure': {
          reject(result)
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

function convertRequestToParams(queryParams: {client_id: string; scope: string}): string {
  return Object.entries(queryParams)
    .map(([key, value]) => value && `${key}=${value}`)
    .filter((hasValue) => Boolean(hasValue))
    .join('&')
}
