import {requestAccessToken} from './exchange.js'
import {IdentityToken} from './schema.js'
import {DeviceAuthorizationResponse} from '../clients/identity/identity-client.js'
import {identityFqdn} from '../../../public/node/context/fqdn.js'
import {shopifyFetch} from '../../../public/node/http.js'
import {isTTY, keypress} from '../../../public/node/ui.js'
import {isCI, openURL} from '../../../public/node/system.js'
import {getIdentityClient} from '../clients/identity/instance.js'
import {IdentityServiceClient} from '../clients/identity/identity-service-client.js'
import {isCloudEnvironment} from '../../../public/node/context/local.js'
import {stringifyMessage} from '../../../public/node/output.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {Response} from 'node-fetch'

// use real client since we stub out network requests in this "integration" test
const mockIdentityClient = new IdentityServiceClient()

vi.mock('../../../public/node/context/fqdn.js')
vi.mock('./identity')
vi.mock('../../../public/node/http.js')
vi.mock('../../../public/node/ui.js')
vi.mock('../../../public/node/system.js')
vi.mock('../clients/identity/instance.js')
vi.mock('../../../public/node/output.js')
vi.mock('../../../public/node/context/local.js')

beforeEach(() => {
  vi.mocked(isTTY).mockReturnValue(true)
  vi.mocked(isCI).mockReturnValue(false)
  vi.mocked(isCloudEnvironment).mockReturnValue(false)
  vi.mocked(keypress).mockResolvedValue(undefined)
  vi.mocked(openURL).mockResolvedValue(true)
  vi.mocked(getIdentityClient).mockImplementation(() => mockIdentityClient)
  // Mock stringifyMessage to pass through strings for error messages
  vi.mocked(stringifyMessage).mockImplementation((msg) => (typeof msg === 'string' ? msg : String(msg)))
})

describe('requestDeviceAuthorization', () => {
  const data: any = {
    device_code: 'device_code',
    user_code: 'user_code',
    verification_uri: 'verification_uri',
    expires_in: 3600,
    verification_uri_complete: 'verification_uri_complete',
    interval: 0.05,
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
    const deviceAuthResponse = new Response(JSON.stringify(data))
    vi.mocked(shopifyFetch).mockResolvedValueOnce(deviceAuthResponse)
    vi.mocked(identityFqdn).mockResolvedValue('fqdn.com')

    // Mock the token exchange to complete the flow
    const tokenResponse = new Response(
      JSON.stringify({
        access_token: 'access_token',
        refresh_token: 'refresh_token',
        expires_in: 3600,
        scope: 'scope1 scope2',
        id_token: 'eyJhbGciOiJub25lIn0.eyJzdWIiOiIxMjM0LTU2NzgiLCJhdWQiOiJpZGVudGl0eSJ9.',
      }),
    )
    vi.mocked(shopifyFetch).mockResolvedValue(tokenResponse)

    // When
    vi.mocked(getIdentityClient).mockReturnValue(mockIdentityClient)
    const got = await requestAccessToken(['scope1', 'scope2'])

    // Then
    expect(shopifyFetch).toHaveBeenCalledWith('https://fqdn.com/oauth/device_authorization', {
      method: 'POST',
      headers: {'Content-type': 'application/x-www-form-urlencoded'},
      body: 'client_id=fbdb2649-e327-4907-8f67-908d24cfd7e3&scope=scope1 scope2',
    })
    expect(got.accessToken).toEqual('access_token')
    expect(got.userId).toEqual('1234-5678')
  })

  test('when the response is not valid JSON, throw an error with context', async () => {
    // Given
    const response = new Response('not valid JSON')
    Object.defineProperty(response, 'status', {value: 200})
    Object.defineProperty(response, 'statusText', {value: 'OK'})
    vi.mocked(shopifyFetch).mockResolvedValue(response)
    vi.mocked(identityFqdn).mockResolvedValue('fqdn.com')

    // When/Then
    vi.mocked(getIdentityClient).mockReturnValue(mockIdentityClient)
    await expect(requestAccessToken(['scope1', 'scope2'])).rejects.toThrowError(
      'Received invalid response from authorization service (HTTP 200). Response could not be parsed as valid JSON. If this issue persists, please contact support at https://help.shopify.com',
    )
  })

  test('when the response is empty, throw an error with empty body message', async () => {
    // Given
    const response = new Response('')
    Object.defineProperty(response, 'status', {value: 200})
    Object.defineProperty(response, 'statusText', {value: 'OK'})
    vi.mocked(shopifyFetch).mockResolvedValue(response)
    vi.mocked(identityFqdn).mockResolvedValue('fqdn.com')

    // When/Then
    vi.mocked(getIdentityClient).mockReturnValue(mockIdentityClient)
    await expect(requestAccessToken(['scope1', 'scope2'])).rejects.toThrowError(
      'Received invalid response from authorization service (HTTP 200). Received empty response body. If this issue persists, please contact support at https://help.shopify.com',
    )
  })

  test('when the response is HTML instead of JSON, throw an error with HTML detection', async () => {
    // Given
    const htmlResponse = '<!DOCTYPE html><html><body>Error page</body></html>'
    const response = new Response(htmlResponse)
    Object.defineProperty(response, 'status', {value: 404})
    Object.defineProperty(response, 'statusText', {value: 'Not Found'})
    vi.mocked(shopifyFetch).mockResolvedValue(response)
    vi.mocked(identityFqdn).mockResolvedValue('fqdn.com')

    // When/Then
    vi.mocked(getIdentityClient).mockReturnValue(mockIdentityClient)
    await expect(requestAccessToken(['scope1', 'scope2'])).rejects.toThrowError(
      'Received invalid response from authorization service (HTTP 404). The request may be malformed or unauthorized. Received HTML instead of JSON - the service endpoint may have changed. If this issue persists, please contact support at https://help.shopify.com',
    )
  })

  test('when the server returns a 500 error with non-JSON response, throw an error with server issue message', async () => {
    // Given
    const response = new Response('Internal Server Error')
    Object.defineProperty(response, 'status', {value: 500})
    Object.defineProperty(response, 'statusText', {value: 'Internal Server Error'})
    vi.mocked(shopifyFetch).mockResolvedValue(response)
    vi.mocked(identityFqdn).mockResolvedValue('fqdn.com')

    // When/Then
    vi.mocked(getIdentityClient).mockReturnValue(mockIdentityClient)
    await expect(requestAccessToken(['scope1', 'scope2'])).rejects.toThrowError(
      'Received invalid response from authorization service (HTTP 500). The service may be experiencing issues. Response could not be parsed as valid JSON. If this issue persists, please contact support at https://help.shopify.com',
    )
  })

  test('when response.text() fails, throw an error about network/streaming issue', async () => {
    // Given
    const response = new Response('some content')
    Object.defineProperty(response, 'status', {value: 200})
    Object.defineProperty(response, 'statusText', {value: 'OK'})
    // Mock text() to throw an error
    response.text = vi.fn().mockRejectedValue(new Error('Network error'))
    vi.mocked(shopifyFetch).mockResolvedValue(response)
    vi.mocked(identityFqdn).mockResolvedValue('fqdn.com')

    // When/Then
    vi.mocked(getIdentityClient).mockReturnValue(mockIdentityClient)
    await expect(requestAccessToken(['scope1', 'scope2'])).rejects.toThrowError(
      'Failed to read response from authorization service (HTTP 200). Network or streaming error occurred.',
    )
  })
})

describe('pollForDeviceAuthorization', () => {
  const data: any = {
    device_code: 'device_code',
    user_code: 'user_code',
    verification_uri: 'verification_uri',
    expires_in: 3600,
    verification_uri_complete: 'verification_uri_complete',
    // Short interval for testing
    interval: 0.05,
  }

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
    const deviceAuthResponse = new Response(JSON.stringify(data))
    vi.mocked(shopifyFetch).mockResolvedValueOnce(deviceAuthResponse)
    vi.mocked(identityFqdn).mockResolvedValue('fqdn.com')
    vi.mocked(getIdentityClient).mockReturnValue(mockIdentityClient)

    // Mock pending responses, then success - set ok: false for error responses
    const pendingResponse1 = new Response(JSON.stringify({error: 'authorization_pending'}))
    Object.defineProperty(pendingResponse1, 'ok', {value: false})
    const pendingResponse2 = new Response(JSON.stringify({error: 'authorization_pending'}))
    Object.defineProperty(pendingResponse2, 'ok', {value: false})
    const pendingResponse3 = new Response(JSON.stringify({error: 'authorization_pending'}))
    Object.defineProperty(pendingResponse3, 'ok', {value: false})

    vi.mocked(shopifyFetch).mockResolvedValueOnce(pendingResponse1)
    vi.mocked(shopifyFetch).mockResolvedValueOnce(pendingResponse2)
    vi.mocked(shopifyFetch).mockResolvedValueOnce(pendingResponse3)

    const successResponse = new Response(
      JSON.stringify({
        access_token: identityToken.accessToken,
        refresh_token: identityToken.refreshToken,
        expires_in: 3600,
        scope: 'scope scope2',
        id_token: 'eyJhbGciOiJub25lIn0.eyJzdWIiOiIxMjM0LTU2NzgiLCJhdWQiOiJpZGVudGl0eSJ9.',
      }),
    )
    Object.defineProperty(successResponse, 'ok', {value: true})
    vi.mocked(shopifyFetch).mockResolvedValueOnce(successResponse)

    // When
    const got = await requestAccessToken(['scope1', 'scope2'])

    // Then - 1 device auth request + 4 polling requests
    expect(shopifyFetch).toBeCalledTimes(5)
    expect(got.accessToken).toEqual(identityToken.accessToken)
  })

  test('when polling, if an error is received, stop polling and throw error', async () => {
    // Given
    const deviceAuthResponse = new Response(JSON.stringify(data))
    vi.mocked(shopifyFetch).mockResolvedValueOnce(deviceAuthResponse)
    vi.mocked(identityFqdn).mockResolvedValue('fqdn.com')
    vi.mocked(getIdentityClient).mockReturnValue(mockIdentityClient)

    // Mock pending responses, then error - set ok: false for all error responses
    const pendingResponse1 = new Response(JSON.stringify({error: 'authorization_pending'}))
    Object.defineProperty(pendingResponse1, 'ok', {value: false})
    const pendingResponse2 = new Response(JSON.stringify({error: 'authorization_pending'}))
    Object.defineProperty(pendingResponse2, 'ok', {value: false})

    vi.mocked(shopifyFetch).mockResolvedValueOnce(pendingResponse1)
    vi.mocked(shopifyFetch).mockResolvedValueOnce(pendingResponse2)

    const errorResponse = new Response(JSON.stringify({error: 'access_denied'}))
    Object.defineProperty(errorResponse, 'ok', {value: false})
    vi.mocked(shopifyFetch).mockResolvedValueOnce(errorResponse)

    // When/Then
    await expect(requestAccessToken(['scope1', 'scope2'])).rejects.toThrow()
    // 1 device auth request + 3 polling requests
    expect(shopifyFetch).toBeCalledTimes(4)
  })
})
