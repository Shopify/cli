import {
  getStorefrontSessionCookies,
  isStorefrontPasswordCorrect,
  isStorefrontPasswordProtected,
  ShopifyEssentialError,
} from './storefront-session.js'
import {describe, expect, test, vi} from 'vitest'
import {fetch} from '@shopify/cli-kit/node/http'
import {AbortError} from '@shopify/cli-kit/node/error'

vi.mock('@shopify/cli-kit/node/http')

describe('Storefront API', () => {
  describe('isStorefrontPasswordProtected', () => {
    test('returns true when the request is redirected to the password page', async () => {
      // Given
      vi.mocked(fetch).mockResolvedValue(
        response({status: 302, headers: {location: 'https://store.myshopify.com/password'}}),
      )

      // When
      const isProtected = await isStorefrontPasswordProtected('store.myshopify.com')

      // Then
      expect(isProtected).toBe(true)
      expect(fetch).toBeCalledWith('https://store.myshopify.com', {
        method: 'GET',
        redirect: 'manual',
      })
    })

    test('returns false when request is not redirected', async () => {
      // Given
      vi.mocked(fetch).mockResolvedValue(response({status: 200}))

      // When
      const isProtected = await isStorefrontPasswordProtected('store.myshopify.com')

      // Then
      expect(isProtected).toBe(false)
      expect(fetch).toBeCalledWith('https://store.myshopify.com', {
        method: 'GET',
        redirect: 'manual',
      })
    })

    test('returns false when store redirects to a different domain', async () => {
      // Given
      vi.mocked(fetch).mockResolvedValue(response({status: 302, headers: {location: 'https://store.myshopify.se'}}))

      // When
      const isProtected = await isStorefrontPasswordProtected('store.myshopify.com')

      // Then
      expect(isProtected).toBe(false)
    })

    test('returns false when store redirects to a different URI', async () => {
      // Given
      vi.mocked(fetch).mockResolvedValue(
        response({status: 302, headers: {location: 'https://store.myshopify.com/random'}}),
      )

      // When
      const isProtected = await isStorefrontPasswordProtected('store.myshopify.com')

      // Then
      expect(isProtected).toBe(false)
    })

    test('return true when store redirects to /<locale>/password', async () => {
      // Given
      vi.mocked(fetch).mockResolvedValue(
        response({status: 302, headers: {location: 'https://store.myshopify.com/fr-CA/password'}}),
      )

      // When
      const isProtected = await isStorefrontPasswordProtected('store.myshopify.com')

      // Then
      expect(isProtected).toBe(true)
    })

    test('returns false if response is not a 302', async () => {
      // Given
      vi.mocked(fetch).mockResolvedValue(
        response({status: 301, headers: {location: 'https://store.myshopify.com/random'}}),
      )

      // When
      const isProtected = await isStorefrontPasswordProtected('store.myshopify.com')

      // Then
      expect(isProtected).toBe(false)
    })
  })

  describe('getStorefrontSessionCookies', () => {
    test('retrieves only _shopify_essential cookie when no password is provided', async () => {
      // Given
      vi.mocked(fetch).mockResolvedValueOnce(
        response({
          status: 200,
          headers: {'set-cookie': '_shopify_essential=:AABBCCDDEEFFGGHH==123:; path=/; HttpOnly'},
        }),
      )

      // When
      const cookies = await getStorefrontSessionCookies('https://example-store.myshopify.com', '123456')

      // Then
      expect(cookies).toEqual({_shopify_essential: ':AABBCCDDEEFFGGHH==123:'})
    })

    test('retrieves _shopify_essential and storefront_digest cookies when a password is provided', async () => {
      // Given
      vi.mocked(fetch)
        .mockResolvedValueOnce(
          response({
            status: 200,
            headers: {'set-cookie': '_shopify_essential=:AABBCCDDEEFFGGHH==123:; path=/; HttpOnly'},
          }),
        )
        .mockResolvedValueOnce(
          response({
            status: 200,
            headers: {'set-cookie': 'storefront_digest=digest-value; path=/; HttpOnly'},
          }),
        )

      // When
      const cookies = await getStorefrontSessionCookies('https://example-store.myshopify.com', '123456', 'password')

      // Then
      expect(cookies).toEqual({_shopify_essential: ':AABBCCDDEEFFGGHH==123:', storefront_digest: 'digest-value'})
    })

    test(`throws an ShopifyEssentialError when _shopify_essential can't be defined`, async () => {
      // Given
      vi.mocked(fetch)
        .mockResolvedValueOnce(
          response({
            status: 200,
            headers: {'set-cookie': ''},
            text: () => Promise.resolve(''),
          }),
        )
        .mockResolvedValueOnce(
          response({
            status: 200,
            headers: {'set-cookie': 'storefront_digest=digest-value; path=/; HttpOnly'},
            text: () => Promise.resolve(''),
          }),
        )

      // When
      const cookies = getStorefrontSessionCookies('https://example-store.myshopify.com', '123456', 'password')

      // Then
      await expect(cookies).rejects.toThrow(
        new ShopifyEssentialError(
          'Your development session could not be created because the "_shopify_essential" could not be defined. Please, check your internet connection.',
        ),
      )
    })

    test('throws an error when the password is wrong', async () => {
      // Given
      vi.mocked(fetch)
        .mockResolvedValueOnce(
          response({
            status: 200,
            headers: {'set-cookie': '_shopify_essential=:AABBCCDDEEFFGGHH==123:; path=/; HttpOnly'},
            text: () => Promise.resolve(''),
          }),
        )
        .mockResolvedValueOnce(
          response({
            status: 401,
            text: () => Promise.resolve(''),
          }),
        )

      // When
      const cookies = getStorefrontSessionCookies('https://example-store.myshopify.com', '123456', 'wrongpassword')

      // Then
      await expect(cookies).rejects.toThrow(
        new AbortError(
          'Your development session could not be created because the store password is invalid. Please, retry with a different password.',
        ),
      )
    })
  })

  // Tests rely on this function because the 'packages/theme' package cannot
  // directly access node-fetch and they use: new Response('OK', {status: 200})
  function response(mock: {status: number; headers?: {[key: string]: string}; text?: () => Promise<string>}) {
    const setCookieHeader = (mock.headers ?? {})['set-cookie'] ?? ''
    const setCookieArray = [setCookieHeader]

    return {
      ...mock,
      headers: {
        ...mock.headers,
        raw: vi.fn().mockReturnValue({'set-cookie': setCookieArray}),
        get: vi.fn().mockImplementation((key) => mock.headers?.[key]),
      },
    } as any
  }

  describe('isStorefrontPasswordCorrect', () => {
    test('returns true when the password is correct', async () => {
      // Given
      vi.mocked(fetch).mockResolvedValueOnce(
        response({
          status: 302,
          headers: {
            location: 'https://store.myshopify.com/',
          },
        }),
      )

      // When
      const result = await isStorefrontPasswordCorrect('correct-password-&', 'store.myshopify.com')

      // Then
      expect(result).toBe(true)
      expect(fetch).toBeCalledWith('https://store.myshopify.com/password', {
        body: 'form_type=storefront_password&utf8=%E2%9C%93&password=correct-password-%26',
        headers: {
          'cache-control': 'no-cache',
          'content-type': 'application/x-www-form-urlencoded',
        },
        method: 'POST',
        redirect: 'manual',
      })
    })

    test('returns false when the password is incorrect', async () => {
      // Given
      vi.mocked(fetch).mockResolvedValueOnce(
        response({
          status: 401,
        }),
      )

      // When
      const result = await isStorefrontPasswordCorrect('wrong-password', 'store.myshopify.com')

      // Then
      expect(result).toBe(false)
    })

    test('returns false when the redirect location is incorrect', async () => {
      // Given
      vi.mocked(fetch).mockResolvedValueOnce(
        response({
          status: 302,
          headers: {
            location: 'https://random-location.com/',
          },
        }),
      )

      // When
      const result = await isStorefrontPasswordCorrect('correct-password', 'store.myshopify.com')

      // Then
      expect(result).toBe(false)
    })

    test('throws an error when the server responds with "Too Many Requests"', async () => {
      // Given
      vi.mocked(fetch).mockResolvedValueOnce(
        response({
          status: 429,
          headers: {
            'retry-after': '60',
          },
        }),
      )

      // When
      const result = isStorefrontPasswordCorrect('wrong-password', 'store.myshopify.com')

      // Then
      await expect(result).rejects.toThrow('Too many incorrect password attempts. Please try again after 60 seconds.')
    })
  })
})
