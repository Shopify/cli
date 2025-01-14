import {
  exchangeAccessForApplicationTokens,
  exchangeCustomPartnerToken,
  InvalidGrantError,
  InvalidRequestError,
  refreshAccessToken,
} from './exchange.js'
import {applicationId, clientId} from './identity.js'
import {IdentityToken} from './schema.js'
import {shopifyFetch} from '../../../public/node/http.js'
import {identityFqdn} from '../../../public/node/context/fqdn.js'
import {getLastSeenUserIdAfterAuth} from '../session.js'
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
  // id_token:{sub: '1234-5678'}
  id_token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0LTU2NzgifQ.L8IiNHncR4xe42f1fLQZFD5D_HBo7oMlfop2FS-NUCU',
}

const identityToken: IdentityToken = {
  accessToken: data.access_token,
  refreshToken: data.refresh_token,
  expiresAt: expiredDate,
  scopes: data.scope.split(' '),
  userId: '1234-5678',
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

describe('exchange identity token for application tokens', () => {
  const scopes = {admin: [], partners: [], storefront: [], businessPlatform: [], appManagement: []}

  test('returns tokens for all APIs if a store is passed', async () => {
    // Given
    vi.mocked(shopifyFetch).mockImplementation(async () => Promise.resolve(new Response(JSON.stringify(data))))

    // When
    const got = await exchangeAccessForApplicationTokens(identityToken, scopes, 'storeFQDN')

    // Then
    const expected = {
      'app-management': {
        accessToken: "access_token",
        expiresAt: expiredDate,
        scopes: [
          "scope",
          "scope2",
        ],
      },
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
      'app-management': {
        accessToken: "access_token",
        expiresAt: expiredDate,
        scopes: [
          "scope",
          "scope2",
        ],
      },
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
  test('throws an InvalidGrantError when Identity returns invalid_grant', async () => {
    // Given
    const error = {error: 'invalid_grant'}
    const response = new Response(JSON.stringify(error), {status: 400})
    vi.mocked(shopifyFetch).mockResolvedValue(response)

    // When
    const got = () => refreshAccessToken(identityToken)

    // Then
    return expect(got).rejects.toThrowError(InvalidGrantError)
  })

  test('throws an InvalidRequestError when Identity returns invalid_request', async () => {
    // Given
    const error = {error: 'invalid_request'}
    const response = new Response(JSON.stringify(error), {status: 400})
    vi.mocked(shopifyFetch).mockResolvedValue(response)

    // When
    const got = () => refreshAccessToken(identityToken)

    // Then
    return expect(got).rejects.toThrowError(InvalidRequestError)
  })

  test('throws an InvalidTargetError when Identity returns invalid_target', async () => {
    // Given
    const error = {error: 'invalid_target'}
    const response = new Response(JSON.stringify(error), {status: 400})
    vi.mocked(shopifyFetch).mockResolvedValue(response)

    // When
    const got = () => refreshAccessToken(identityToken)

    // Then
    await expect(got).rejects.toThrowError(
      'You are not authorized to use the CLI to develop in the provided store.' +
        '\n\n' +
        "You can't use Shopify CLI with development stores if you only have Partner " +
        'staff member access. If you want to use Shopify CLI to work on a development store, then ' +
        'you should be the store owner or create a staff account on the store.' +
        '\n\n' +
        "If you're the store owner, then you need to log in to the store directly using the " +
        'store URL at least once before you log in using Shopify CLI.' +
        'Logging in to the Shopify admin directly connects the development ' +
        'store with your Shopify login.',
    )
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

describe('exchangeCustomPartnerToken', () => {
  const token = 'customToken'

  // Generated from `customToken` using `nonRandomUUID()`
  const userId = 'eab16ac4-0690-5fed-9d00-71bd202a3c2b37259a8f'

  test('returns access token and user ID for a valid token', async () => {
    // Given
    const data = {
      access_token: 'access_token',
      expires_in: 300,
      scope: 'scope,scope2',
    }
    // Given
    const response = new Response(JSON.stringify(data))

    // Need to do it 3 times because a Response can only be used once
    vi.mocked(shopifyFetch).mockResolvedValue(response)

    // When
    const result = await exchangeCustomPartnerToken(token)

    // Then
    expect(result).toEqual({accessToken: 'access_token', userId})
    await expect(getLastSeenUserIdAfterAuth()).resolves.toBe(userId)
  })
})
