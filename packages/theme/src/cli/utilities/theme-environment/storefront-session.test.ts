import {
  getStorefrontSessionCookies,
  isStorefrontPasswordCorrect,
  isStorefrontPasswordProtected,
  ShopifyEssentialError,
} from './storefront-session.js'
import {describe, expect, test, vi} from 'vitest'
import {shopifyFetch} from '@shopify/cli-kit/node/http'
import {AbortError} from '@shopify/cli-kit/node/error'
import {passwordProtected} from '@shopify/cli-kit/node/themes/api'
import {type AdminSession} from '@shopify/cli-kit/node/session'

vi.mock('@shopify/cli-kit/node/http')
vi.mock('@shopify/cli-kit/node/themes/api')

describe('Storefront API', () => {
  describe('isStorefrontPasswordProtected', () => {
    const adminSession: AdminSession = {
      storeFqdn: 'example-store.myshopify.com',
      token: '123456',
    }

    test('makes an API call to check if the storefront is password protected', async () => {
      // Given
      vi.mocked(passwordProtected).mockResolvedValueOnce(true)

      // When
      const isProtected = await isStorefrontPasswordProtected(adminSession)

      // Then
      expect(isProtected).toBe(true)
      expect(passwordProtected).toHaveBeenCalledWith(adminSession)
    })
  })

  describe('getStorefrontSessionCookies', () => {
    test('retrieves only _shopify_essential cookie when no password is provided', async () => {
      // Given
      vi.mocked(shopifyFetch).mockResolvedValueOnce(
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
      vi.mocked(shopifyFetch)
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
      vi.mocked(shopifyFetch)
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
      vi.mocked(shopifyFetch)
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
  function response(mock: {
    status: number
    url?: string
    headers?: {[key: string]: string}
    text?: () => Promise<string>
  }) {
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
      vi.mocked(shopifyFetch).mockResolvedValueOnce(
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
      expect(shopifyFetch).toBeCalledWith('https://store.myshopify.com/password', {
        body: 'form_type=storefront_password&utf8=%E2%9C%93&password=correct-password-%26',
        headers: {
          'cache-control': 'no-cache',
          'content-type': 'application/x-www-form-urlencoded',
        },
        method: 'POST',
        redirect: 'manual',
      })
    })

    test('returns true when the password is correct and the store redirects to a localized URL', async () => {
      // Given
      vi.mocked(shopifyFetch).mockResolvedValueOnce(
        response({
          status: 302,
          headers: {
            location: 'https://store.myshopify.com/en',
          },
        }),
      )

      // When
      const result = await isStorefrontPasswordCorrect('correct-password', 'store.myshopify.com')

      // Then
      expect(result).toBe(true)
    })

    test('returns true when the password is correct and the store name is capitalized', async () => {
      // Given
      vi.mocked(shopifyFetch).mockResolvedValueOnce(
        response({
          status: 302,
          headers: {
            location: 'https://store.myshopify.com',
          },
        }),
      )

      // When
      const result = await isStorefrontPasswordCorrect('correct-password-&', 'Store.myshopify.com')

      // Then
      expect(result).toBe(true)
      expect(shopifyFetch).toBeCalledWith('https://Store.myshopify.com/password', {
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
      vi.mocked(shopifyFetch).mockResolvedValueOnce(
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
      vi.mocked(shopifyFetch).mockResolvedValueOnce(
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

    test('returns false when the redirect location has a different origin', async () => {
      // Given
      vi.mocked(shopifyFetch).mockResolvedValueOnce(
        response({
          status: 302,
          headers: {
            location: 'https://another-store.myshopify.com/',
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
      vi.mocked(shopifyFetch).mockResolvedValueOnce(
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
