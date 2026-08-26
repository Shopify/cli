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
import {AbortError} from '../../../public/node/error.js'
import {isCI, openURL} from '../../../public/node/system.js'
import * as output from '../../../public/node/output.js'
import {setInputDisabled} from '../../../public/node/global-context.js'

import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {Response} from 'node-fetch'

vi.mock('../../../public/node/context/fqdn.js')
vi.mock('./identity')
vi.mock('../../../public/node/http.js')
vi.mock('../../../public/node/ui.js')
vi.mock('./exchange.js')
vi.mock('../../../public/node/system.js')

beforeEach(() => {
  setInputDisabled(false)
  vi.mocked(isTTY).mockReturnValue(true)
  vi.mocked(isCI).mockReturnValue(false)
  vi.mocked(openURL).mockResolvedValue(true)
})

afterEach(() => setInputDisabled(false))

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
      body: 'client_id=clientId&scope=scope1+scope2',
    })
    expect(got).toEqual(dataExpected)
  })

  test('encodes special characters in authorization scopes', async () => {
    // Given
    const response = new Response(JSON.stringify(data))
    vi.mocked(shopifyFetch).mockResolvedValue(response)
    vi.mocked(identityFqdn).mockResolvedValue('fqdn.com')
    vi.mocked(clientId).mockReturnValue('clientId')

    // When
    await requestDeviceAuthorization(['scope&=%'])

    // Then
    expect(shopifyFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({body: 'client_id=clientId&scope=scope%26%3D%25'}),
    )
  })

  test('omits empty authorization scope values', async () => {
    // Given
    const response = new Response(JSON.stringify(data))
    vi.mocked(shopifyFetch).mockResolvedValue(response)
    vi.mocked(identityFqdn).mockResolvedValue('fqdn.com')
    vi.mocked(clientId).mockReturnValue('clientId')

    // When
    await requestDeviceAuthorization([])

    // Then
    expect(shopifyFetch).toHaveBeenCalledWith('https://fqdn.com/oauth/device_authorization', {
      method: 'POST',
      headers: {'Content-type': 'application/x-www-form-urlencoded'},
      body: 'client_id=clientId',
    })
  })

  test('does not include authorization credentials in debug output', async () => {
    // Given
    const outputDebug = vi.spyOn(output, 'outputDebug')
    const outputInfo = vi.spyOn(output, 'outputInfo')
    const response = new Response(JSON.stringify(data), {status: 200})
    vi.mocked(shopifyFetch).mockResolvedValue(response)
    vi.mocked(identityFqdn).mockResolvedValue('fqdn.com')
    vi.mocked(clientId).mockReturnValue('clientId')

    // When
    await requestDeviceAuthorization(['scope1', 'scope2'])

    // Then
    const debugOutput = JSON.stringify(outputDebug.mock.calls)
    const infoOutput = JSON.stringify(outputInfo.mock.calls)
    expect(debugOutput).toContain('HTTP 200')
    expect(debugOutput).toContain('interval=5')
    expect(debugOutput).toContain('expires_in=3600')
    expect(debugOutput).not.toContain(data.device_code)
    expect(debugOutput).not.toContain(data.verification_uri_complete)
    expect(infoOutput).toContain(data.user_code)
    expect(infoOutput).toContain(data.verification_uri_complete)
  })

  test('uses an explicit marker when the response omits the polling interval', async () => {
    // Given
    const outputDebug = vi.spyOn(output, 'outputDebug')
    outputDebug.mockClear()
    const response = new Response(JSON.stringify({...data, interval: undefined}), {status: 200})
    vi.mocked(shopifyFetch).mockResolvedValue(response)
    vi.mocked(identityFqdn).mockResolvedValue('fqdn.com')
    vi.mocked(clientId).mockReturnValue('clientId')

    // When
    await requestDeviceAuthorization(['scope1', 'scope2'])

    // Then
    const debugOutput = JSON.stringify(outputDebug.mock.calls)
    expect(debugOutput).toContain('interval=not provided')
  })

  test('opens the browser directly in an interactive terminal', async () => {
    // Given
    const outputInfo = vi.spyOn(output, 'outputInfo')
    const response = new Response(JSON.stringify(data))
    vi.mocked(shopifyFetch).mockResolvedValue(response)
    vi.mocked(identityFqdn).mockResolvedValue('fqdn.com')
    vi.mocked(clientId).mockReturnValue('clientId')

    // When
    await requestDeviceAuthorization(['scope1', 'scope2'])

    // Then
    expect(openURL).toHaveBeenCalledWith(data.verification_uri_complete)
    expect(outputInfo).not.toHaveBeenCalledWith('👉 Press any key to open the login page on your browser')
  })

  test('does not open the browser when input is disabled', async () => {
    const response = new Response(JSON.stringify(data))
    vi.mocked(shopifyFetch).mockResolvedValue(response)
    vi.mocked(identityFqdn).mockResolvedValue('fqdn.com')
    vi.mocked(clientId).mockReturnValue('clientId')
    setInputDisabled(true)

    await expect(requestDeviceAuthorization(['scope1', 'scope2'])).rejects.toThrow(
      'Authorization is required to continue, but the current environment does not support interactive prompts.',
    )
    expect(openURL).not.toHaveBeenCalled()
  })

  test('when the response is not valid JSON, throw an error with context', async () => {
    // Given
    const response = new Response('not valid JSON')
    Object.defineProperty(response, 'status', {value: 200})
    Object.defineProperty(response, 'statusText', {value: 'OK'})
    vi.mocked(shopifyFetch).mockResolvedValue(response)
    vi.mocked(identityFqdn).mockResolvedValue('fqdn.com')
    vi.mocked(clientId).mockReturnValue('clientId')

    // When/Then
    await expect(requestDeviceAuthorization(['scope1', 'scope2'])).rejects.toThrowError(
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
    vi.mocked(clientId).mockReturnValue('clientId')

    // When/Then
    await expect(requestDeviceAuthorization(['scope1', 'scope2'])).rejects.toThrowError(
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
    vi.mocked(clientId).mockReturnValue('clientId')

    // When/Then
    await expect(requestDeviceAuthorization(['scope1', 'scope2'])).rejects.toThrowError(
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
    vi.mocked(clientId).mockReturnValue('clientId')

    // When/Then
    await expect(requestDeviceAuthorization(['scope1', 'scope2'])).rejects.toThrowError(
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
    vi.mocked(clientId).mockReturnValue('clientId')

    // When/Then
    await expect(requestDeviceAuthorization(['scope1', 'scope2'])).rejects.toThrowError(
      'Failed to read response from authorization service (HTTP 200). Network or streaming error occurred.',
    )
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

  test('when polling, if an access denied error is received, stop polling and throw AbortError', async () => {
    // Given
    vi.mocked(exchangeDeviceCodeForAccessToken).mockResolvedValueOnce(err('access_denied'))

    // When
    const got = pollForDeviceAuthorization('device_code', 0.05)

    // Then
    await expect(got).rejects.toThrow(new AbortError(`Device authorization failed: Access denied.`))
  })

  test('when polling, if an expired token error is received, stop polling and throw AbortError', async () => {
    // Given
    vi.mocked(exchangeDeviceCodeForAccessToken).mockResolvedValueOnce(err('expired_token'))

    // When
    const got = pollForDeviceAuthorization('device_code', 0.05)

    // Then
    await expect(got).rejects.toThrow(new AbortError(`Device authorization failed: Token expired. Please try again.`))
  })

  test('when polling, if an unknown failure is received, stop polling and throw error', async () => {
    // Given
    vi.mocked(exchangeDeviceCodeForAccessToken).mockResolvedValueOnce(err('unknown_failure'))

    // When
    const got = pollForDeviceAuthorization('device_code', 0.05)

    // Then
    await expect(got).rejects.toThrow(new Error('Device authorization failed: unknown_failure'))
  })

  test('when polling, if an unrecognized error code slips through, stop polling instead of hanging', async () => {
    const unexpectedCode = 'invalid_client' as never
    vi.mocked(exchangeDeviceCodeForAccessToken).mockResolvedValueOnce(err(unexpectedCode))

    // When
    const got = pollForDeviceAuthorization('device_code', 0.05)

    // Then
    await expect(got).rejects.toThrow(new Error('Device authorization failed: invalid_client'))
  })
})
