import {clientId} from './identity.js'
import {exchangeDeviceCodeForAccessToken} from './exchange.js'
import {IdentityToken} from './schema.js'
import {identity as identityFqdn} from '../environment/fqdn.js'
import {shopifyFetch} from '../http.js'
import {content, debug, info, token} from '../output.js'

export async function pollForDeviceAuthorization(code: string, interval = 5): Promise<IdentityToken> {
  let cumulativeErrorTimer = 0
  let currentIntervalInSeconds = interval

  return new Promise<IdentityToken>((resolve, reject) => {
    const onPoll = async () => {
      const result = await exchangeDeviceCodeForAccessToken(code)
      if (result.token) return resolve(result.token)
      const error = result.error ?? 'unknown_failure'

      debug(content`Polling for device authorization... status: ${error}`)
      switch (error) {
        case 'authorization_pending':
          cumulativeErrorTimer = 0
          return startPolling()
        case 'slow_down':
          cumulativeErrorTimer = 0
          currentIntervalInSeconds += 5
          return startPolling()
        case 'access_denied':
        case 'expired_token':
          cumulativeErrorTimer = 0
          return reject(result)
        default:
          if (cumulativeErrorTimer >= 120) {
            return reject(result)
          } else {
            cumulativeErrorTimer += currentIntervalInSeconds
            return startPolling()
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

export interface DeviceAuthorizationResponse {
  deviceCode: string
  userCode: string
  verificationUri: string
  expiresIn: number
  verificationUriComplete?: string
  interval?: number
}

export async function requestDeviceAuthorization(scopes: string[]): Promise<DeviceAuthorizationResponse> {
  const identityClientId = await clientId()

  const queryParams = {
    client_id: identityClientId,
    scope: scopes.join(' '),
  }
  const fqdn = await identityFqdn()
  const url = `https://${fqdn}/oauth/device_authorization`

  const response = await shopifyFetch('identity', url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-type': 'application/x-www-form-urlencoded',
      'Accept-Encoding': 'gzip',
    },
    body: convertRequestToParams(queryParams),
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonResult: any = await response.json()

  debug(content`Received device authorization code: ${token.json(jsonResult)}`)

  info('\nTo run this command, log in to Shopify Partners.')
  info(content`User verification code: ${jsonResult.user_code}`)
  info(content`👉 Open ${token.link('this Link', jsonResult.verification_uri_complete)} to start the auth process`)

  return {
    deviceCode: jsonResult.device_code,
    userCode: jsonResult.user_code,
    verificationUri: jsonResult.verification_uri,
    expiresIn: jsonResult.expires_in,
    verificationUriComplete: jsonResult.verification_uri_complete,
    interval: jsonResult.interval,
  }
}

function convertRequestToParams(queryParams: {client_id: string; scope: string}): string {
  return Object.entries(queryParams)
    .map(([key, value]) => value && `${key}=${value}`)
    .filter((hasValue) => Boolean(hasValue))
    .join('&')
}
