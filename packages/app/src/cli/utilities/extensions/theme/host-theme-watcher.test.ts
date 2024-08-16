import {FAILED_TO_CREATE_THEME_MESSAGE, UPDATER_TIMEOUT, waitForThemeToBeProcessed} from './host-theme-watcher.js'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {sleep} from '@shopify/cli-kit/node/system'
import {fetchTheme} from '@shopify/cli-kit/node/themes/api'
import {describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('@shopify/cli-kit/node/system')

describe('HostThemeWatcher', () => {
  const themeId = 12345
  const adminSession: AdminSession = {token: 'token', storeFqdn: 'storeFqdn'}

  test('should wait for the theme to be processed', async () => {
    // Given
    vi.mocked(sleep).mockResolvedValue()
    vi.mocked(fetchTheme)
      .mockResolvedValueOnce({
        processing: true,
        id: themeId,
        name: 'Theme',
        role: 'development',
        createdAtRuntime: true,
      })
      .mockResolvedValue({
        processing: false,
        id: themeId,
        name: 'Theme',
        role: 'development',
        createdAtRuntime: true,
      })

    // When
    await waitForThemeToBeProcessed(themeId, adminSession, Date.now())

    // Then
    expect(fetchTheme).toHaveBeenCalledTimes(2)
  })

  test('should throw an error if the theme is not processed within the timeout', async () => {
    // Given
    vi.mocked(fetchTheme).mockResolvedValue({
      processing: true,
      id: themeId,
      name: 'Theme',
      role: 'development',
      createdAtRuntime: true,
    })

    // When
    const promise = waitForThemeToBeProcessed(themeId, adminSession, Date.now() - UPDATER_TIMEOUT)

    // Then
    await expect(promise).rejects.toThrowError(FAILED_TO_CREATE_THEME_MESSAGE)
  })

  test('should throw an error if the theme is not found', async () => {
    // Given
    vi.mocked(fetchTheme).mockResolvedValue(undefined)

    // When
    const promise = waitForThemeToBeProcessed(themeId, adminSession, Date.now())

    // Then
    await expect(promise).rejects.toThrowError(FAILED_TO_CREATE_THEME_MESSAGE)
  })
})
