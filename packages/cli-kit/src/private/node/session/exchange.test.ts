import {
  exchangeAccessForApplicationTokens,
  exchangeCustomPartnerToken,
  exchangeCliTokenForAppManagementAccessToken,
  exchangeCliTokenForBusinessPlatformAccessToken,
  InvalidGrantError,
  InvalidRequestError,
  refreshAccessToken,
  requestAppToken,
} from './exchange.js'
import {applicationId, clientId} from './identity.js'
import {IdentityToken} from './schema.js'
import {shopifyFetch} from '../../../public/node/http.js'
import {identityFqdn} from '../../../public/node/context/fqdn.js'
import {getLastSeenUserIdAfterAuth, getLastSeenAuthMethod} from '../session.js'
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
        accessToken: 'access_token',
        expiresAt: expiredDate,
        scopes: ['scope', 'scope2'],
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
        accessToken: 'access_token',
        expiresAt: expiredDate,
        scopes: ['scope', 'scope2'],
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
        'store URL at least once before you log in using Shopify CLI. ' +
        'Logging in to the Shopify admin directly connects the development ' +
        'store with your Shopify login.',
    )
  })

  describe('when there is a store in the request params', () => {
    test('includes the store in the error message', async () => {
      // Given
      const error = {error: 'invalid_target'}
      const response = new Response(JSON.stringify(error), {status: 400})
      vi.mocked(shopifyFetch).mockResolvedValue(response)

      // When
      const got = () => requestAppToken('admin', 'token', undefined, 'bob.myshopify.com')

      // Then
      await expect(got).rejects.toThrowError(
        'You are not authorized to use the CLI to develop in the provided store: bob.myshopify.com' +
          '\n\n' +
          "You can't use Shopify CLI with development stores if you only have Partner " +
          'staff member access. If you want to use Shopify CLI to work on a development store, then ' +
          'you should be the store owner or create a staff account on the store.' +
          '\n\n' +
          "If you're the store owner, then you need to log in to the store directly using the " +
          'store URL at least once before you log in using Shopify CLI. ' +
          'Logging in to the Shopify admin directly connects the development ' +
          'store with your Shopify login.',
      )
    })
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

const tokenExchangeMethods = [
  {
    tokenExchangeMethod: exchangeCustomPartnerToken,
    expectedScopes: ['https://api.shopify.com/auth/partners.app.cli.access'],
    expectedApi: 'partners',
    expectedErrorName: 'Partners',
  },
  {
    tokenExchangeMethod: exchangeCliTokenForAppManagementAccessToken,
    expectedScopes: ['https://api.shopify.com/auth/organization.apps.manage'],
    expectedApi: 'app-management',
    expectedErrorName: 'App Management',
  },
  {
    tokenExchangeMethod: exchangeCliTokenForBusinessPlatformAccessToken,
    expectedScopes: ['https://api.shopify.com/auth/destinations.readonly'],
    expectedApi: 'business-platform',
    expectedErrorName: 'Business Platform',
  },
]

describe.each(tokenExchangeMethods)(
  'Token exchange: %s',
  ({tokenExchangeMethod, expectedScopes, expectedApi, expectedErrorName}) => {
    const cliToken = 'customToken'
    // Generated from `customToken` using `nonRandomUUID()`
    const userId = 'eab16ac4-0690-5fed-9d00-71bd202a3c2b37259a8f'

    const grantType = 'urn:ietf:params:oauth:grant-type:token-exchange'
    const accessTokenType = 'urn:ietf:params:oauth:token-type:access_token'

    test(`Executing ${tokenExchangeMethod.name} returns access token and user ID for a valid CLI token`, async () => {
      // Given
      let capturedUrl = ''
      vi.mocked(shopifyFetch).mockImplementation(async (url, options) => {
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        capturedUrl = url.toString()
        return Promise.resolve(
          new Response(
            JSON.stringify({
              access_token: 'expected_access_token',
              expires_in: 300,
              scope: 'scope,scope2',
            }),
          ),
        )
      })

      // When
      const result = await tokenExchangeMethod(cliToken)

      // Then
      expect(result).toEqual({accessToken: 'expected_access_token', userId})
      await expect(getLastSeenUserIdAfterAuth()).resolves.toBe(userId)
      await expect(getLastSeenAuthMethod()).resolves.toBe('partners_token')

      // Assert token exchange parameters are correct
      const actualUrl = new URL(capturedUrl)
      expect(actualUrl).toBeDefined()
      expect(actualUrl.href).toContain('https://fqdn.com/oauth/token')

      const params = actualUrl.searchParams
      expect(params.get('grant_type')).toBe(grantType)
      expect(params.get('requested_token_type')).toBe(accessTokenType)
      expect(params.get('subject_token_type')).toBe(accessTokenType)
      expect(params.get('client_id')).toBe('clientId')
      expect(params.get('audience')).toBe(expectedApi)
      expect(params.get('scope')).toBe(expectedScopes.join(' '))
      expect(params.get('subject_token')).toBe(cliToken)
    })

    test(`Executing ${tokenExchangeMethod.name} throws AbortError if an error is caught`, async () => {
      const expectedErrorMessage = `The custom token provided can't be used for the ${expectedErrorName} API.`
      vi.mocked(shopifyFetch).mockImplementation(async () => {
        throw new Error('BAD ERROR')
      })

      try {
        await tokenExchangeMethod(cliToken)
      } catch (error) {
        if (error instanceof Error) {
          expect(error).toBeInstanceOf(AbortError)
          expect(error.message).toBe(expectedErrorMessage)
        } else {
          throw error
        }
      }
    })
  },
)
