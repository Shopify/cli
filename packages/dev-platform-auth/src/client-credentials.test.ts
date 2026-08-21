import {requestClientCredentialsToken} from './client-credentials.js'
import {describe, expect, test} from 'vitest'
import type {AuthFetch, ClientCredentialsTokenRequest} from './index.js'

const request: ClientCredentialsTokenRequest = {
  storeFqdn: 'example.myshopify.com',
  clientId: 'client-id',
  clientSecret: 'client-secret',
}

const requestWithSignal = request as ClientCredentialsTokenRequest & {signal: unknown}

test('does not expose cancellation on the client-credentials request', () => {
  expect('signal' in requestWithSignal).toBe(false)
})

function fetchResponse(status: number, body: string): AuthFetch {
  return async () => ({status, text: async () => body})
}

describe('requestClientCredentialsToken', () => {
  test('returns the access token and store without fabricated expiry', async () => {
    await expect(
      requestClientCredentialsToken({fetch: fetchResponse(200, '{"access_token":"token"}')}, request),
    ).resolves.toEqual({
      accessToken: 'token',
      storeFqdn: request.storeFqdn,
    })
  })

  test('maps app_not_installed only from a 400 raw response', async () => {
    await expect(
      requestClientCredentialsToken({fetch: fetchResponse(400, 'app_not_installed')}, request),
    ).resolves.toEqual({
      serverCode: 'app_not_installed',
      status: 400,
    })
    await expect(
      requestClientCredentialsToken({fetch: fetchResponse(500, 'app_not_installed')}, request),
    ).resolves.toMatchObject({
      kind: 'malformed_response',
      status: 500,
    })
  })

  test.each([200, 400, 500])('classifies malformed JSON as malformed_response for HTTP %s', async (status) => {
    await expect(
      requestClientCredentialsToken({fetch: fetchResponse(status, 'not-json')}, request),
    ).resolves.toMatchObject({
      kind: 'malformed_response',
      status,
    })
  })

  test.each([
    [500, true, 'server_error'],
    [200, false, 'token'],
  ] as const)('uses numeric status rather than ok (%s/%s)', async (status, ok, expected) => {
    const fetch: AuthFetch = async () => ({ok, status, text: async () => '{"access_token":"token"}'})
    const result = await requestClientCredentialsToken({fetch}, request)
    if (expected === 'token') {
      expect(result).toEqual({accessToken: 'token', storeFqdn: request.storeFqdn})
    } else {
      expect(result).toEqual({serverCode: 'unknown_error', status})
      expect(result).not.toHaveProperty('accessToken')
    }
  })

  test('rejects successful JSON without a non-empty access token', async () => {
    await expect(requestClientCredentialsToken({fetch: fetchResponse(200, '{}')}, request)).resolves.toEqual({
      kind: 'malformed_response',
      status: 200,
    })
    await expect(
      requestClientCredentialsToken({fetch: fetchResponse(200, '{"access_token":""}')}, request),
    ).resolves.toEqual({
      kind: 'malformed_response',
      status: 200,
    })
  })

  test('classifies an unexpected non-JSON error shape as unexpected_status', async () => {
    await expect(requestClientCredentialsToken({fetch: fetchResponse(500, '"unexpected"')}, request)).resolves.toEqual({
      kind: 'unexpected_status',
      status: 500,
    })
  })

  test.each([
    ['unknown code', '{"error":"not_a_known_code"}'],
    ['missing code', '{}'],
    ['empty code', '{"error":""}'],
  ])('uses a safe server code for %s', async (_name, body) => {
    await expect(requestClientCredentialsToken({fetch: fetchResponse(400, body)}, request)).resolves.toMatchObject({
      serverCode: body === '{"error":"not_a_known_code"}' ? 'not_a_known_code' : 'unknown_error',
      status: 400,
    })
  })

  test('classifies a fetch failure as transport_failed without leaking its cause', async () => {
    const fetch: AuthFetch = async () => {
      throw new Error('upstream secret')
    }
    await expect(requestClientCredentialsToken({fetch}, request)).resolves.toMatchObject({kind: 'transport_failed'})
  })

  test('classifies a missing fetch as transport_failed', async () => {
    await expect(requestClientCredentialsToken({}, request)).resolves.toMatchObject({kind: 'transport_failed'})
  })
})
