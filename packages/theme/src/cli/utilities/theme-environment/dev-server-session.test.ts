import {
  abortOnMissingRequiredFile,
  getStorefrontSessionCookiesWithVerification,
  initializeDevServerSession,
} from './dev-server-session.js'
import {getStorefrontSessionCookies, ShopifyEssentialError} from './storefront-session.js'
import {ensureAuthenticatedStorefront, ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {fetchThemeAssets, themeDelete} from '@shopify/cli-kit/node/themes/api'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'
import {stringifyMessage} from '@shopify/cli-kit/node/output'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('./storefront-session.js')

const storeFqdn = 'my-shop.myshopify.com'
const themeId = '123'
const adminSession = {
  token: 'token',
  storeFqdn,
}
const mockLayoutAsset = {
  key: 'layout/theme.liquid',
  value: 'content',
  checksum: 'asdf',
}
const mockConfigAsset = {
  key: 'config/settings_schema.json',
  value: '[]',
  checksum: 'fdsa',
}

describe('getStorefrontSessionCookiesWithVerification', () => {
  test('calls verifyRequiredFilesExist when ShopifyEssentialError is thrown', async () => {
    // Given
    vi.mocked(getStorefrontSessionCookies).mockRejectedValue(new ShopifyEssentialError('Test error'))
    vi.mocked(fetchThemeAssets).mockResolvedValue([mockLayoutAsset])

    // When
    const cookiesWithVerification = getStorefrontSessionCookiesWithVerification(
      storeFqdn,
      themeId,
      adminSession,
      'storefront-token',
      'storefront-password ',
    )

    // Then
    await expect(cookiesWithVerification).rejects.toThrow(
      new AbortError(
        stringifyMessage([
          'Theme ',
          {color: {text: themeId, color: 'cyan'}},
          ' is missing required files. Run ',
          {color: {text: `shopify theme delete -t ${themeId}`, color: 'cyan'}},
          ' to delete it, then try your command again.',
        ]),
      ),
    )
  })
})

describe('verifyRequiredFilesExist', () => {
  beforeEach(() => {
    vi.mocked(themeDelete).mockResolvedValue(true)
  })

  test('succeeds when both required files exist', async () => {
    // Given
    vi.mocked(fetchThemeAssets).mockResolvedValue([mockLayoutAsset, mockConfigAsset])

    // When
    const abortOnMissingFiles = abortOnMissingRequiredFile(themeId, adminSession)

    // Then
    await expect(abortOnMissingFiles).resolves.not.toThrow()
  })

  test('throws an AbortError if any file is missing', async () => {
    // Given
    vi.mocked(fetchThemeAssets).mockResolvedValue([mockLayoutAsset])

    // When
    const abortOnMissingFiles = abortOnMissingRequiredFile(themeId, adminSession)

    // Then
    await expect(abortOnMissingFiles).rejects.toThrow()
  })
})

describe('dev server session', async () => {
  describe('initializeDevServerSession', async () => {
    test('returns a session', async () => {
      // Given
      vi.mocked(ensureAuthenticatedStorefront).mockResolvedValue('storefront_token')
      vi.mocked(getStorefrontSessionCookies).mockResolvedValue({
        _shopify_essential: ':AABBCCDDEEFFGGHH==123:',
        storefront_digest: 'digest_value',
      })
      vi.mocked(ensureAuthenticatedThemes).mockResolvedValue({
        token: 'token_1',
        storeFqdn,
      })

      // When
      const session = await initializeDevServerSession(themeId, adminSession)

      // Then
      expect(session).toEqual(
        expect.objectContaining({
          refresh: expect.any(Function),
          sessionCookies: {
            _shopify_essential: ':AABBCCDDEEFFGGHH==123:',
            storefront_digest: 'digest_value',
          },
          storeFqdn: 'my-shop.myshopify.com',
          storefrontToken: 'storefront_token',
          token: 'token_1',
        }),
      )
    })

    test('returns a refreshable session', async () => {
      // Given
      for (const index of [1, 2, 3]) {
        vi.mocked(ensureAuthenticatedStorefront).mockResolvedValueOnce(`storefront_token_${index}`)
        vi.mocked(getStorefrontSessionCookies).mockResolvedValueOnce({
          _shopify_essential: `:AABBCCDDEEFFGGHH==${index}:`,
          storefront_digest: `digest_value_${index}`,
        })
        vi.mocked(ensureAuthenticatedThemes).mockResolvedValueOnce({
          token: `token_${index}`,
          storeFqdn,
        })
      }

      // When
      const session = await initializeDevServerSession(themeId, adminSession)
      await session.refresh?.()
      await session.refresh?.()

      // Then
      expect(session).toEqual(
        expect.objectContaining({
          refresh: expect.any(Function),
          sessionCookies: {
            _shopify_essential: ':AABBCCDDEEFFGGHH==3:',
            storefront_digest: 'digest_value_3',
          },
          storeFqdn: 'my-shop.myshopify.com',
          storefrontToken: 'storefront_token_3',
          token: 'token_3',
        }),
      )
    })
  })
})
