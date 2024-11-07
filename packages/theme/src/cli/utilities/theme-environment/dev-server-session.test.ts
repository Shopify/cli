import {verifyRequiredFilesExist} from './dev-server-session.js'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {fetchThemeAssets, themeDelete} from '@shopify/cli-kit/node/themes/api'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {ThemeAsset} from '@shopify/cli-kit/node/themes/types'

vi.mock('@shopify/cli-kit/node/themes/api')

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

describe('verifyRequiredFilesExist', () => {
  beforeEach(() => {
    vi.mocked(themeDelete).mockResolvedValue(true)
  })

  test('succeeds when both required files exist', async () => {
    // Given
    vi.mocked(fetchThemeAssets).mockResolvedValue([mockLayoutAsset, mockConfigAsset])

    // When
    await expect(verifyRequiredFilesExist(themeId, mockAdminSession)).resolves.not.toThrow()

    // Then
    expect(themeDelete).not.toHaveBeenCalled()
  })

  test('retries once and succeeds if files exist on second attempt', async () => {
    // Given
    vi.mocked(fetchThemeAssets).mockResolvedValueOnce([]).mockResolvedValue([mockLayoutAsset, mockConfigAsset])

    // When
    const promise = verifyRequiredFilesExist(themeId, mockAdminSession, 0)

    // Then
    await expect(promise).resolves.not.toThrow()
    expect(fetchThemeAssets).toHaveBeenCalledTimes(2)
    expect(themeDelete).not.toHaveBeenCalled()
  })

  test('deletes theme and throws if any file is missing after retry', async () => {
    // Given
    vi.mocked(fetchThemeAssets).mockResolvedValue([mockLayoutAsset])

    // When
    const promise = verifyRequiredFilesExist(themeId, mockAdminSession, 0)

    // Then
    await expect(promise).rejects.toThrowError(
      'Invalid theme removed from storefront. Please try deleting the theme and recreating it.',
    )
    expect(fetchThemeAssets).toHaveBeenCalledTimes(2)
    expect(themeDelete).toHaveBeenCalledWith(1234, mockAdminSession)
  })
})
