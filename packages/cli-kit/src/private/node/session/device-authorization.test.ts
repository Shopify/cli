import {
  DeviceAuthorizationResponse,
  pollForDeviceAuthorization,
  requestDeviceAuthorization,
} from './device-authorization.js'
import {clientId} from './identity.js'
import {IdentityToken} from './schema.js'
import {exchangeDeviceCodeForAccessToken} from './exchange.js'
import {identityFqdn} from '../../../public/node/context/fqdn.js'
import {shopifyFetch} from '../../../public/node/http.js'
import {isTTY} from '../../../public/node/ui.js'
import {err, ok} from '../../../public/node/result.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {Response} from 'node-fetch'
import {isCI} from '@shopify/cli-kit/node/system'

vi.mock('../../../public/node/context/fqdn.js')
vi.mock('./identity')
vi.mock('../../../public/node/http.js')
vi.mock('../../../public/node/ui.js')
vi.mock('./exchange.js')
vi.mock('../../../public/node/system.js')

beforeEach(() => {
  vi.mocked(isTTY).mockReturnValue(true)
  vi.mocked(isCI).mockReturnValue(false)
})

describe('requestDeviceAuthorization', () => {
  const data: any = {
    device_code: 'device_code',
    user_code: 'user_code',
    verification_uri: 'verification_uri',
    expires_in: 3600,
    verification_uri_complete: 'verification_uri_complete',
    interval: 5,
  }

  const dataExpected: DeviceAuthorizationResponse = {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    expiresIn: data.expires_in,
    verificationUriComplete: data.verification_uri_complete,
    interval: data.interval,
  }

  test('requests an authorization code to initiate the device auth', async () => {
    // Given
    const response = new Response(JSON.stringify(data))
    vi.mocked(shopifyFetch).mockResolvedValue(response)
    vi.mocked(identityFqdn).mockResolvedValue('fqdn.com')
    vi.mocked(clientId).mockReturnValue('clientId')

    // When
    const got = await requestDeviceAuthorization(['scope1', 'scope2'])

    // Then
    expect(shopifyFetch).toBeCalledWith('https://fqdn.com/oauth/device_authorization', {
      method: 'POST',
      headers: {'Content-type': 'application/x-www-form-urlencoded'},
      body: 'client_id=clientId&scope=scope1 scope2',
    })
    expect(got).toEqual(dataExpected)
  })
})

describe('pollForDeviceAuthorization', () => {
  const identityToken: IdentityToken = {
    accessToken: 'access_token',
    refreshToken: 'refresh_token',
    expiresAt: new Date(2022, 1, 1, 11),
    scopes: ['scope', 'scope2'],
    userId: '1234-5678',
    alias: '1234-5678',
  }

  test('poll until a valid token is received', async () => {
    // Given
    vi.mocked(exchangeDeviceCodeForAccessToken).mockResolvedValueOnce(err('authorization_pending'))
    vi.mocked(exchangeDeviceCodeForAccessToken).mockResolvedValueOnce(err('authorization_pending'))
    vi.mocked(exchangeDeviceCodeForAccessToken).mockResolvedValueOnce(err('authorization_pending'))
    vi.mocked(exchangeDeviceCodeForAccessToken).mockResolvedValueOnce(ok(identityToken))

    // When
    const got = await pollForDeviceAuthorization('device_code', 0.05)

    // Then
    expect(exchangeDeviceCodeForAccessToken).toBeCalledTimes(4)
    expect(got).toEqual(identityToken)
  })

  test('when polling, if an error is received, stop polling and throw error', async () => {
    // Given
    vi.mocked(exchangeDeviceCodeForAccessToken).mockResolvedValueOnce(err('authorization_pending'))
    vi.mocked(exchangeDeviceCodeForAccessToken).mockResolvedValueOnce(err('authorization_pending'))
    vi.mocked(exchangeDeviceCodeForAccessToken).mockResolvedValueOnce(err('access_denied'))

    // When
    const got = pollForDeviceAuthorization('device_code', 0.05)

    // Then
    await expect(got).rejects.toThrow()
    expect(exchangeDeviceCodeForAccessToken).toBeCalledTimes(3)
  })
})
