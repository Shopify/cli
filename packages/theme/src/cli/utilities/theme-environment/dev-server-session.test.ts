import {abortOnMissingRequiredFile, getStorefrontSessionCookiesWithVerification} from './dev-server-session.js'
import {getStorefrontSessionCookies, ShopifyEssentialError} from './storefront-session.js'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {fetchThemeAssets, themeDelete} from '@shopify/cli-kit/node/themes/api'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {ThemeAsset} from '@shopify/cli-kit/node/themes/types'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'

vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('./storefront-session.js')

const mockAdminSession: AdminSession = {token: 'token', storeFqdn: 'store.myshopify.com'}
const themeId = '1234'

const mockLayoutAsset: ThemeAsset = {
  key: 'layout/theme.liquid',
  value: 'content',
  attachment: undefined,
  checksum: 'asdf',
}

const mockConfigAsset: ThemeAsset = {
  key: 'config/settings_schema.json',
  value: '[]',
  attachment: undefined,
  checksum: 'fdsa',
}

describe('getStorefrontSessionCookiesWithVerification', () => {
  test('calls verifyRequiredFilesExist when ShopifyEssentialError is thrown', async () => {
    // Given
    vi.mocked(getStorefrontSessionCookies).mockRejectedValue(new ShopifyEssentialError('Test error'))
    vi.mocked(fetchThemeAssets).mockResolvedValue([mockLayoutAsset])

    // When/Then
    await expect(
      getStorefrontSessionCookiesWithVerification(
        mockAdminSession.storeFqdn,
        themeId,
        mockAdminSession,
        'storefront-token',
        'storefront-password ',
      ),
    ).rejects.toThrow(
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
    // Then
    await expect(abortOnMissingRequiredFile(themeId, mockAdminSession)).resolves.not.toThrow()
  })

  //   throws an AbortError if any file is missing
  test('throws an AbortError if any file is missing', async () => {
    // Given
    vi.mocked(fetchThemeAssets).mockResolvedValue([mockLayoutAsset])

    // When
    // Then
    await expect(abortOnMissingRequiredFile(themeId, mockAdminSession)).rejects.toThrow()
  })
})
