import {verifyRequiredFilesExist} from './dev-server-session.js'
import {fetchThemeAssets, themeDelete} from '@shopify/cli-kit/node/themes/api'
import {describe, expect, test, vi} from 'vitest'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {ThemeAsset} from '@shopify/cli-kit/node/themes/types'

vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('timers', () => ({
  setTimeout: () => Promise.resolve(),
}))

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
    const promise = verifyRequiredFilesExist(themeId, mockAdminSession)
    vi.runAllTimers()
    await expect(promise).resolves.not.toThrow()

    // Then
    expect(fetchThemeAssets).toHaveBeenCalledTimes(2)
    expect(themeDelete).not.toHaveBeenCalled()
  })

  test('deletes theme and throws if any file is missing after retry', async () => {
    // Given
    vi.mocked(fetchThemeAssets).mockResolvedValue([mockLayoutAsset])
    vi.mocked(themeDelete).mockResolvedValue(true)

    // When
    const promise = verifyRequiredFilesExist(themeId, mockAdminSession)
    vi.runAllTimers()
    await expect(promise).rejects.toThrow(
      'Invalid theme removed from storefront. Please try deleting the theme and recreating it.',
    )

    // Then
    expect(themeDelete).toHaveBeenCalledWith(1234, mockAdminSession)
  })
})
