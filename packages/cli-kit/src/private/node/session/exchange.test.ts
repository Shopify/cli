import {
  exchangeAccessForApplicationTokens,
  exchangeCodeForAccessToken,
  InvalidGrantError,
  InvalidRequestError,
  refreshAccessToken,
} from './exchange.js'
import {applicationId, clientId} from './identity.js'
import {IdentityToken} from './schema.js'
import {shopifyFetch} from '../../../public/node/http.js'
import {identityFqdn} from '../../../public/node/context/fqdn.js'
import {describe, test, expect, vi, afterAll, beforeEach} from 'vitest'
import {Response} from 'node-fetch'
import {AbortError} from '@shopify/cli-kit/node/error'

const currentDate = new Date(2022, 1, 1, 10)
const expiredDate = new Date(2022, 1, 1, 11)

const data: any = {
  access_token: 'access_token',
  refresh_token: 'refresh_token',
  scope: 'scope scope2',
  expires_in: 3600,
}

const identityToken: IdentityToken = {
  accessToken: data.access_token,
  refreshToken: data.refresh_token,
  expiresAt: expiredDate,
  scopes: data.scope.split(' '),
}

vi.mock('../../../public/node/http.js')
vi.mock('../../../public/node/context/fqdn.js')
vi.mock('./identity')

beforeEach(() => {
  vi.mocked(clientId).mockReturnValue('clientId')
  vi.setSystemTime(currentDate)
  vi.mocked(applicationId).mockImplementation((api) => api)
  vi.mocked(identityFqdn).mockResolvedValue('fqdn.com')
})

afterAll(() => {
  // Restore Date mock
  vi.useRealTimers()
})

describe('exchange code for identity token', () => {
  const code = {code: 'code', codeVerifier: 'verifier'}

  test('obtains an identity token from a authorization code', async () => {
    // Given
    const response = new Response(JSON.stringify(data))
    vi.mocked(shopifyFetch).mockResolvedValue(response)

    // When
    const got = await exchangeCodeForAccessToken(code)

    // Then
    expect(shopifyFetch).toBeCalledWith(
      'https://fqdn.com/oauth/token?grant_type=authorization_code&code=code&redirect_uri=http%3A%2F%2F127.0.0.1%3A3456&client_id=clientId&code_verifier=verifier',
      {method: 'POST'},
    )
    expect(got).toEqual(identityToken)
  })

  test('Throws HTTP error if the request fails', () => {
    // Given
    const responseBody = {
      error: 'invalid_grant',
      error_description: 'Invalid grant',
    }
    const response = new Response(JSON.stringify(responseBody), {status: 500})
    vi.mocked(shopifyFetch).mockResolvedValue(response)

    // When
    const got = () => exchangeCodeForAccessToken(code)

    // Then
    return expect(got).rejects.toThrowError()
  })
})

describe('exchange identity token for application tokens', () => {
  const scopes = {admin: [], partners: [], storefront: [], businessPlatform: []}

  test('returns tokens for all APIs if a store is passed', async () => {
    // Given
    const response = new Response(JSON.stringify(data))

    // Need to do it 3 times because a Response can only be used once
    vi.mocked(shopifyFetch)
      .mockResolvedValue(response)
      .mockResolvedValueOnce(response.clone())
      .mockResolvedValueOnce(response.clone())
      .mockResolvedValueOnce(response.clone())

    // When
    const got = await exchangeAccessForApplicationTokens(identityToken, scopes, 'storeFQDN')

    // Then
    const expected = {
      partners: {
        accessToken: 'access_token',
        expiresAt: expiredDate,
        scopes: ['scope', 'scope2'],
      },
      'storefront-renderer': {
        accessToken: 'access_token',
        expiresAt: expiredDate,
        scopes: ['scope', 'scope2'],
      },
      'storeFQDN-admin': {
        accessToken: 'access_token',
        expiresAt: expiredDate,
        scopes: ['scope', 'scope2'],
      },
      'business-platform': {
        accessToken: 'access_token',
        expiresAt: expiredDate,
        scopes: ['scope', 'scope2'],
      },
    }
    expect(got).toEqual(expected)
  })

  test('does not return token for admin if there is no store', async () => {
    // Given
    const response = new Response(JSON.stringify(data))

    // Need to do it 3 times because a Response can only be used once
    vi.mocked(shopifyFetch)
      .mockResolvedValue(response)
      .mockResolvedValueOnce(response.clone())
      .mockResolvedValueOnce(response.clone())
      .mockResolvedValueOnce(response.clone())

    // When
    const got = await exchangeAccessForApplicationTokens(identityToken, scopes, undefined)

    // Then
    const expected = {
      partners: {
        accessToken: 'access_token',
        expiresAt: expiredDate,
        scopes: ['scope', 'scope2'],
      },
      'storefront-renderer': {
        accessToken: 'access_token',
        expiresAt: expiredDate,
        scopes: ['scope', 'scope2'],
      },
      'business-platform': {
        accessToken: 'access_token',
        expiresAt: expiredDate,
        scopes: ['scope', 'scope2'],
      },
    }
    expect(got).toEqual(expected)
  })
})

describe('refresh access tokens', () => {
  test('throws a InvalidGrantError when Identity returns invalid_grant', async () => {
    // Given
    const error = {error: 'invalid_grant'}
    const response = new Response(JSON.stringify(error), {status: 400})
    vi.mocked(shopifyFetch).mockResolvedValue(response)

    // When
    const got = () => refreshAccessToken(identityToken)

    // Then
    return expect(got).rejects.toThrowError(InvalidGrantError)
  })

  test('throws a InvalidRequestError when Identity returns invalid_request', async () => {
    // Given
    const error = {error: 'invalid_request'}
    const response = new Response(JSON.stringify(error), {status: 400})
    vi.mocked(shopifyFetch).mockResolvedValue(response)

    // When
    const got = () => refreshAccessToken(identityToken)

    // Then
    return expect(got).rejects.toThrowError(InvalidRequestError)
  })

  test('throws an AbortError when Identity returns another error', async () => {
    // Given
    const error = {error: 'another'}
    const response = new Response(JSON.stringify(error), {status: 400})
    vi.mocked(shopifyFetch).mockResolvedValue(response)

    // When
    const got = () => refreshAccessToken(identityToken)

    // Then
    return expect(got).rejects.toThrowError(AbortError)
  })
})
