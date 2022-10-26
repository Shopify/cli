import {
  DeviceAuthorizationResponse,
  pollForDeviceAuthorization,
  requestDeviceAuthorization,
} from './device-authorization.js'
import {clientId} from './identity.js'
import {exchangeDeviceCodeForAccessToken} from './exchange.js'
import {IdentityToken} from './schema.js'
import {identity} from '../environment/fqdn.js'
import {shopifyFetch} from '../http.js'
import {err, ok} from '../public/common/result.js'
import {describe, expect, it, vi} from 'vitest'
import {Response} from 'node-fetch'

vi.mock('../environment/fqdn')
vi.mock('./identity')
vi.mock('../http')
vi.mock('./exchange.js')

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

  it('requests an authorization code to initiate the device auth', async () => {
    // Given
    const response = new Response(JSON.stringify(data))
    vi.mocked(shopifyFetch).mockResolvedValue(response)
    vi.mocked(identity).mockResolvedValue('fqdn.com')
    vi.mocked(clientId).mockResolvedValue('clientId')

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
  }

  it('poll until a valid token is received', async () => {
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

  it('when polling, if an error is received, stop polling and throw error', async () => {
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
