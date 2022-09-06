import {clientId} from './identity.js'
import {allDefaultScopes} from './scopes.js'
import {exchangeDeviceCodeForAccessToken} from './exchange.js'
import {IdentityToken} from './schema.js'
import {identity as identityFqdn} from '../environment/fqdn.js'
import {shopifyFetch} from '../http.js'

export async function pollForDeviceAuthorization(code: string, interval = 5): Promise<IdentityToken> {
  let cumulativeErrorTimer = 0

  let currentTimerId: undefined | ReturnType<typeof setTimeout>
  let currentIntervalInSeconds = interval
  let isPollingTerminated = false

  const stopPolling = () => {
    if (currentTimerId) {
      isPollingTerminated = true
      clearTimeout(currentTimerId)
      currentTimerId = undefined
    }
  }

  return new Promise<IdentityToken>((resolve, reject) => {
    const onPoll = async () => {
      console.log('POLLING...')

      const result = await exchangeDeviceCodeForAccessToken(code)

      if (result.token) return resolve(result.token)

      console.log(result.error)
      switch (result.error) {
        case 'authorization_pending':
          cumulativeErrorTimer = 0
          return startPolling()
        case 'slow_down':
          cumulativeErrorTimer = 0
          currentIntervalInSeconds += 5
          return startPolling()
        case 'access_denied':
          cumulativeErrorTimer = 0
          return reject(result)
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
      if (!isPollingTerminated) {
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        currentTimerId = setTimeout(onPoll, currentIntervalInSeconds * 1000)
      }
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

export async function requestDeviceAuthorization(): Promise<DeviceAuthorizationResponse> {
  const identityClientId = await clientId()

  const queryParams = {
    client_id: identityClientId,
    scope: allDefaultScopes().join('%20'),
    // this.config.scopes.join('%20'),
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
