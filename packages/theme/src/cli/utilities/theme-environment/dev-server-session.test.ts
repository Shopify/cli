import {
  abortOnMissingRequiredFile,
  getStorefrontSessionCookiesWithVerification,
  initializeDevServerSession,
  fetchDevServerSession,
} from './dev-server-session.js'
import {getStorefrontSessionCookies, ShopifyEssentialError} from './storefront-session.js'
import {getToken} from '@shopify/cli-kit/node/session'
import {fetchThemeAssets, themeDelete} from '@shopify/cli-kit/node/themes/api'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'

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
        outputContent`Theme ${outputToken.cyan(themeId)} is missing required files. Run ${outputToken.cyan(
          `shopify theme delete -t ${themeId}`,
        )} to delete it, then try your command again.`.value,
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
  describe('fetchDevServerSession', async () => {
    test('calls getToken with noPrompt: true', async () => {
      // Given
      vi.mocked(getToken).mockResolvedValueOnce('token_1').mockResolvedValueOnce('storefront_token')
      vi.mocked(getStorefrontSessionCookies).mockResolvedValue({
        _shopify_essential: ':AABBCCDDEEFFGGHH==123:',
        storefront_digest: 'digest_value',
      })

      // When
      await fetchDevServerSession(themeId, adminSession, 'admin-password')

      // Then
      expect(getToken).toHaveBeenCalledWith('admin', {
        storeFqdn,
        password: 'admin-password',
        forceRefresh: false,
        noPrompt: true,
      })
    })
  })

  describe('initializeDevServerSession', async () => {
    test('returns a session', async () => {
      // Given
      vi.mocked(getToken).mockResolvedValueOnce('token_1').mockResolvedValueOnce('storefront_token')
      vi.mocked(getStorefrontSessionCookies).mockResolvedValue({
        _shopify_essential: ':AABBCCDDEEFFGGHH==123:',
        storefront_digest: 'digest_value',
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
        vi.mocked(getToken).mockResolvedValueOnce(`token_${index}`).mockResolvedValueOnce(`storefront_token_${index}`)
        vi.mocked(getStorefrontSessionCookies).mockResolvedValueOnce({
          _shopify_essential: `:AABBCCDDEEFFGGHH==${index}:`,
          storefront_digest: `digest_value_${index}`,
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
