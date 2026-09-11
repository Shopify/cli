import {
  exchangeAccessForApplicationTokens,
  exchangeCustomPartnerToken,
  exchangeAppAutomationTokenForAppManagementAccessToken,
  exchangeAppAutomationTokenForBusinessPlatformAccessToken,
  exchangeDeviceCodeForAccessToken,
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
import {AbortError} from '../../../public/node/error.js'
import {outputDebug} from '../../../public/node/output.js'
import {err, ok} from '../../../public/node/result.js'

import {describe, test, expect, vi, afterAll, beforeEach} from 'vitest'
import {Response} from 'node-fetch'

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
  alias: '1234-5678',
}

vi.mock('../../../public/node/http.js')
vi.mock('../../../public/node/context/fqdn.js')
vi.mock('./identity')
vi.mock('../../../public/node/output.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../public/node/output.js')>()),
  outputDebug: vi.fn(),
}))

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

  test('rejects when any application token exchange fails', async () => {
    vi.mocked(shopifyFetch).mockRejectedValue(new Error('exchange failed'))

    await expect(exchangeAccessForApplicationTokens(identityToken, scopes, 'storeFQDN')).rejects.toThrow(
      'exchange failed',
    )
  })

  test('sends admin destination and store parameters and uses the store-qualified key', async () => {
    const requests: {body?: string}[] = []
    vi.mocked(shopifyFetch).mockImplementation(async (_url, options) => {
      requests.push(options as {body?: string})
      return new Response(JSON.stringify(data))
    })

    const result = await requestAppToken('admin', 'identity-access', ['scope-a', 'scope-b'], 'shop.myshopify.com')

    expect(result).toHaveProperty('shop.myshopify.com-admin')
    const params = new URLSearchParams(requests[0]!.body)
    expect(params.get('audience')).toBe('admin')
    expect(params.get('scope')).toBe('scope-a scope-b')
    expect(params.get('subject_token')).toBe('identity-access')
    expect(params.get('destination')).toBe('https://shop.myshopify.com/admin')
    expect(params.get('store')).toBe('shop.myshopify.com')
  })

  test('uses the application ID as the key for non-admin exchanges', async () => {
    vi.mocked(shopifyFetch).mockResolvedValue(new Response(JSON.stringify(data)))

    const result = await requestAppToken('partners', 'identity-access', ['scope'])

    expect(Object.keys(result)).toEqual(['partners'])
  })

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
  test('sends the current access and refresh tokens and preserves user ID and alias', async () => {
    let requestBody = ''
    vi.mocked(shopifyFetch).mockImplementation(async (_url, options) => {
      requestBody = String((options as {body?: string}).body)
      return new Response(JSON.stringify({...data, access_token: 'new-access', refresh_token: 'new-refresh'}))
    })

    const result = await refreshAccessToken({...identityToken, alias: 'named account'})
    const params = new URLSearchParams(requestBody)

    expect(params.get('grant_type')).toBe('refresh_token')
    expect(params.get('access_token')).toBe(identityToken.accessToken)
    expect(params.get('refresh_token')).toBe(identityToken.refreshToken)
    expect(params.get('client_id')).toBe('clientId')
    expect(result.userId).toBe(identityToken.userId)
    expect(result.alias).toBe('named account')
  })
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
    await expect(got).rejects.toThrowError('You are not authorized to use the CLI to develop in the provided store.')
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
        'You are not authorized to use the CLI to develop in the provided store: bob.myshopify.com',
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

  test('preserves the alias when refreshing access token', async () => {
    // Given
    const tokenWithAlias: IdentityToken = {
      ...identityToken,
      alias: 'my-custom-alias',
    }
    const refreshData = {
      access_token: 'new_access_token',
      refresh_token: 'new_refresh_token',
      scope: 'new_scope',
      expires_in: 7200,
      id_token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI1Njc4LTEyMzQifQ.2OGPUmd5MTEv-J5p3Ra4mskCN0635qN8lh3p5_BcoYY',
    }
    const response = new Response(JSON.stringify(refreshData))
    vi.mocked(shopifyFetch).mockResolvedValue(response)

    // When
    const result = await refreshAccessToken(tokenWithAlias)

    // Then
    expect(result.accessToken).toBe('new_access_token')
    expect(result.refreshToken).toBe('new_refresh_token')
    expect(result.scopes).toEqual(['new_scope'])
    // Original userId is preserved
    expect(result.userId).toBe('1234-5678')
    // Alias is preserved
    expect(result.alias).toBe('my-custom-alias')
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
    tokenExchangeMethod: exchangeAppAutomationTokenForAppManagementAccessToken,
    expectedScopes: ['https://api.shopify.com/auth/organization.apps.manage'],
    expectedApi: 'app-management',
    expectedErrorName: 'App Management',
  },
  {
    tokenExchangeMethod: exchangeAppAutomationTokenForBusinessPlatformAccessToken,
    expectedScopes: ['https://api.shopify.com/auth/destinations.readonly'],
    expectedApi: 'business-platform',
    expectedErrorName: 'Business Platform',
  },
]

describe.each(tokenExchangeMethods)(
  'Token exchange: %s',
  ({tokenExchangeMethod, expectedScopes, expectedApi, expectedErrorName}) => {
    const automationToken = 'customToken'
    // Generated from `customToken` using `nonRandomUUID()`
    const userId = 'eab16ac4-0690-5fed-9d00-71bd202a3c2b37259a8f'

    const grantType = 'urn:ietf:params:oauth:grant-type:token-exchange'
    const accessTokenType = 'urn:ietf:params:oauth:token-type:access_token'

    test(`Executing ${tokenExchangeMethod.name} returns access token and user ID for a valid CLI token`, async () => {
      // Given
      let capturedUrl = ''
      let capturedInit: {method?: string; headers?: Record<string, string>; body?: string} = {}
      vi.mocked(shopifyFetch).mockImplementation(async (url, options) => {
        capturedUrl = url.toString()
        capturedInit = (options ?? {}) as typeof capturedInit
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
      const result = await tokenExchangeMethod(automationToken)

      // Then
      expect(result).toEqual({accessToken: 'expected_access_token', userId})
      await expect(getLastSeenUserIdAfterAuth()).resolves.toBe(userId)
      await expect(getLastSeenAuthMethod()).resolves.toBe('partners_token')

      // Request is sent as POST form-encoded body (not query string), so the
      // URL must not contain any OAuth parameters.
      const actualUrl = new URL(capturedUrl)
      expect(actualUrl).toBeDefined()
      expect(actualUrl.href).toBe('https://fqdn.com/oauth/token')
      expect(actualUrl.search).toBe('')

      expect(capturedInit.method).toBe('POST')
      expect(capturedInit.headers).toMatchObject({
        'Content-Type': 'application/x-www-form-urlencoded',
      })
      expect(typeof capturedInit.body).toBe('string')

      // Assert token exchange parameters are correct and sent in the body.
      const params = new URLSearchParams(capturedInit.body)
      expect(params.get('grant_type')).toBe(grantType)
      expect(params.get('requested_token_type')).toBe(accessTokenType)
      expect(params.get('subject_token_type')).toBe(accessTokenType)
      expect(params.get('client_id')).toBe('clientId')
      expect(params.get('audience')).toBe(expectedApi)
      expect(params.get('scope')).toBe(expectedScopes.join(' '))
      expect(params.get('subject_token')).toBe(automationToken)
    })

    test(`Executing ${tokenExchangeMethod.name} throws AbortError and logs the caught error if an error is caught`, async () => {
      const expectedErrorMessage = `The custom token provided can't be used for the ${expectedErrorName} API.`
      vi.mocked(shopifyFetch).mockImplementation(async () => {
        throw new Error('BAD ERROR')
      })

      // When/Then: the user-facing message stays generic, the caught error goes to the debug log.
      await expect(tokenExchangeMethod(automationToken)).rejects.toThrowError(
        new AbortError(expectedErrorMessage, 'Ensure the token is correct and not expired.'),
      )
      expect(outputDebug).toHaveBeenCalledWith(`Token exchange for the ${expectedErrorName} API failed: BAD ERROR`)
    })

    test(`Executing ${tokenExchangeMethod.name} logs the error and description returned by Identity in verbose output`, async () => {
      // Given
      const identityError = {
        error: 'invalid_request',
        error_description: "Invalid 'subject_token' value: invalid",
      }
      vi.mocked(shopifyFetch).mockResolvedValue(new Response(JSON.stringify(identityError), {status: 400}))

      // When/Then: the reason returned by Identity reaches the debug log, never the error message.
      await expect(tokenExchangeMethod(automationToken)).rejects.toThrowError(
        new AbortError(
          `The custom token provided can't be used for the ${expectedErrorName} API.`,
          'Ensure the token is correct and not expired.',
        ),
      )
      expect(outputDebug).toHaveBeenCalledWith(
        "Token request to Identity failed with status 400: invalid_request - Invalid 'subject_token' value: invalid",
      )
    })

    test(`Executing ${tokenExchangeMethod.name} logs unknown_error when the response has no error field`, async () => {
      // Given
      const malformedError = {error_description: 'Token was revoked'}
      vi.mocked(shopifyFetch).mockResolvedValue(new Response(JSON.stringify(malformedError), {status: 400}))

      // When/Then
      await expect(tokenExchangeMethod(automationToken)).rejects.toThrowError(
        new AbortError(
          `The custom token provided can't be used for the ${expectedErrorName} API.`,
          'Ensure the token is correct and not expired.',
        ),
      )
      expect(outputDebug).toHaveBeenCalledWith(
        'Token request to Identity failed with status 400: unknown_error - Token was revoked',
      )
    })

    test(`Executing ${tokenExchangeMethod.name} truncates a long description in the debug log`, async () => {
      // Given
      const identityError = {
        error: 'invalid_request',
        error_description: 'x'.repeat(300),
      }
      vi.mocked(shopifyFetch).mockResolvedValue(new Response(JSON.stringify(identityError), {status: 400}))

      // When
      await expect(tokenExchangeMethod(automationToken)).rejects.toThrowError()

      // Then
      const expectedDescription = 'x'.repeat(200)
      expect(outputDebug).toHaveBeenCalledWith(
        `Token request to Identity failed with status 400: invalid_request - ${expectedDescription}`,
      )
    })

    test(`Executing ${tokenExchangeMethod.name} truncates the message of a caught error in the debug log`, async () => {
      // Given
      vi.mocked(shopifyFetch).mockImplementation(async () => {
        throw new Error('y'.repeat(300))
      })

      // When
      await expect(tokenExchangeMethod(automationToken)).rejects.toThrowError()

      // Then
      const expectedReason = 'y'.repeat(200)
      expect(outputDebug).toHaveBeenCalledWith(
        `Token exchange for the ${expectedErrorName} API failed: ${expectedReason}`,
      )
    })

    test(`logs unknown error for ${expectedErrorName}`, async () => {
      // Given
      vi.mocked(shopifyFetch).mockRejectedValue('non-Error rejection')

      // When/Then
      const result = tokenExchangeMethod(automationToken)
      await expect(result).rejects.toBeInstanceOf(AbortError)

      const expectedMessage = [`Token exchange for the ${expectedErrorName} API`, 'failed: unknown error'].join(' ')

      expect(outputDebug).toHaveBeenCalledWith(expectedMessage)
    })
  },
)

describe('exchange device code for access token', () => {
  test('returns the identity token when the exchange succeeds', async () => {
    // Given
    vi.mocked(shopifyFetch).mockResolvedValue(new Response(JSON.stringify(data)))

    // When
    const result = await exchangeDeviceCodeForAccessToken('device_code')

    // Then: a fresh device login carries no pre-existing alias.
    expect(result).toEqual(ok({...identityToken, alias: undefined}))
  })

  test('passes a recognized device error code through to the poll loop', async () => {
    // Given
    vi.mocked(shopifyFetch).mockResolvedValue(
      new Response(JSON.stringify({error: 'authorization_pending'}), {status: 400}),
    )

    // When
    const result = await exchangeDeviceCodeForAccessToken('device_code')

    // Then
    expect(result).toEqual(err('authorization_pending'))
  })

  test.each(['access_denied', 'expired_token', 'slow_down'])('passes %s through to the poll loop', async (error) => {
    vi.mocked(shopifyFetch).mockResolvedValue(new Response(JSON.stringify({error}), {status: 400}))

    await expect(exchangeDeviceCodeForAccessToken('device_code')).resolves.toEqual(err(error as any))
  })

  test('maps an unrecognized error code to unknown_failure', async () => {
    // Given: Identity can return OAuth codes outside the device set, e.g. invalid_client.
    vi.mocked(shopifyFetch).mockResolvedValue(new Response(JSON.stringify({error: 'invalid_client'}), {status: 400}))

    // When
    const result = await exchangeDeviceCodeForAccessToken('device_code')

    // Then
    expect(result).toEqual(err('unknown_failure'))
  })

  test('computes expiry and scopes from a successful response and reads user ID from the JWT', async () => {
    vi.mocked(shopifyFetch).mockResolvedValue(new Response(JSON.stringify(data)))

    const result = await exchangeDeviceCodeForAccessToken('device_code')

    expect(result).toEqual(ok({...identityToken, alias: undefined}))
    if (result.isErr()) throw new Error('expected a successful device exchange')
    expect(result.value.expiresAt).toEqual(new Date(currentDate.getTime() + 3600 * 1000))
    expect(result.value.scopes).toEqual(['scope', 'scope2'])
    expect(result.value.userId).toBe('1234-5678')
  })

  test('fails with BugError when a token has neither a JWT subject nor existing user ID', async () => {
    vi.mocked(shopifyFetch).mockResolvedValue(
      new Response(JSON.stringify({...data, id_token: undefined}), {status: 200}),
    )

    await expect(exchangeDeviceCodeForAccessToken('device_code')).rejects.toThrow(
      'Error setting userId for session. No id_token or pre-existing user ID provided.',
    )
  })

  test('maps a response with no error field to unknown_failure', async () => {
    // Given: tokenRequest normalizes a missing error field to 'unknown_error', which is not
    // a device error code and must not leak into the poll loop.
    vi.mocked(shopifyFetch).mockResolvedValue(
      new Response(JSON.stringify({error_description: 'no code'}), {status: 400}),
    )

    // When
    const result = await exchangeDeviceCodeForAccessToken('device_code')

    // Then
    expect(result).toEqual(err('unknown_failure'))
  })
})
