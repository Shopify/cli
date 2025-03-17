import {waitForThemeToBeProcessed} from './host-theme-watcher.js'
import {HostThemeManager, DEFAULT_THEME_ZIP, FALLBACK_THEME_ZIP} from './host-theme-manager.js'
import {themeCreate} from '@shopify/cli-kit/node/themes/api'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {DEVELOPMENT_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {ThemeManager} from '@shopify/cli-kit/node/themes/theme-manager'

vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('./host-theme-watcher.js')

describe('HostThemeManager', () => {
  let themeManager: HostThemeManager
  const adminSession: AdminSession = {token: 'token', storeFqdn: 'storeFqdn'}

  beforeEach(() => {
    themeManager = new HostThemeManager(adminSession, {devPreview: true})
    vi.spyOn(ThemeManager.prototype, 'generateThemeName').mockImplementation(() => 'App Ext. Host Name')
  })

  test('should call themeCreate with the provided name and src param', async () => {
    vi.mocked(themeCreate).mockResolvedValue({
      id: 12345,
      name: 'Theme',
      role: 'development',
      createdAtRuntime: true,
      processing: true,
    })

    // When
    await themeManager.findOrCreate()

    // Then
    expect(themeCreate).toHaveBeenCalledWith(
      {
        name: 'App Ext. Host Name',
        role: DEVELOPMENT_THEME_ROLE,
        src: DEFAULT_THEME_ZIP,
      },
      {storeFqdn: 'storeFqdn', token: 'token'},
    )
  })

  describe('dev preview', () => {
    test('should call themeCreate with the provided name and src param', async () => {
      // Given
      vi.mocked(themeCreate).mockResolvedValue({
        id: 12345,
        name: 'Theme',
        role: 'development',
        createdAtRuntime: true,
        processing: true,
      })

      // When
      await themeManager.findOrCreate()

      // Then
      expect(themeCreate).toHaveBeenCalledWith(
        {
          name: 'App Ext. Host Name',
          role: DEVELOPMENT_THEME_ROLE,
          src: DEFAULT_THEME_ZIP,
        },
        {storeFqdn: 'storeFqdn', token: 'token'},
      )
    })

    test('should wait for the theme to be processed', async () => {
      // Given
      vi.mocked(themeCreate).mockResolvedValue({
        id: 12345,
        name: 'Theme',
        role: 'development',
        createdAtRuntime: true,
        processing: true,
      })
      vi.mocked(waitForThemeToBeProcessed).mockResolvedValue()

      // When
      await themeManager.findOrCreate()

      // Then
      expect(waitForThemeToBeProcessed).toHaveBeenCalledTimes(1)
    })

    test('should retry creating the theme if the first attempt fails', async () => {
      // Given
      vi.mocked(themeCreate).mockResolvedValueOnce(undefined).mockResolvedValueOnce({
        id: 12345,
        name: 'Theme',
        role: 'development',
        createdAtRuntime: true,
        processing: true,
      })

      // When
      await themeManager.findOrCreate()

      // Then
      expect(themeCreate).toHaveBeenCalledTimes(2)
      expect(themeCreate).toHaveBeenNthCalledWith(
        1,
        {
          role: DEVELOPMENT_THEME_ROLE,
          name: 'App Ext. Host Name',
          src: DEFAULT_THEME_ZIP,
        },
        adminSession,
      )
      expect(themeCreate).toHaveBeenNthCalledWith(
        2,
        {
          role: DEVELOPMENT_THEME_ROLE,
          name: 'App Ext. Host Name',
          src: DEFAULT_THEME_ZIP,
        },
        adminSession,
      )
    })

    test('should gracefully handle a 422 from the server during theme creation', async () => {
      // Given
      vi.mocked(themeCreate)
        .mockRejectedValueOnce(new Error('API request unprocessable content: {"src":["is empty"]}'))
        .mockRejectedValueOnce(new Error('API request unprocessable content: {"src":["is empty"]}'))
        .mockResolvedValueOnce({
          id: 12345,
          name: 'Theme',
          role: 'development',
          createdAtRuntime: true,
          processing: true,
        })

      // When
      await themeManager.findOrCreate()

      // Then
      expect(themeCreate).toHaveBeenCalledTimes(3)
    })

    test('should retry creating the theme with the Fallback theme zip after 3 failed retry attempts', async () => {
      // Given
      vi.mocked(themeCreate)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValue({
          id: 12345,
          name: 'Theme',
          role: 'development',
          createdAtRuntime: true,
          processing: true,
        })

      // When
      await themeManager.findOrCreate()

      // Then
      expect(themeCreate).toHaveBeenCalledTimes(4)
      expect(themeCreate).toHaveBeenLastCalledWith(
        {
          role: DEVELOPMENT_THEME_ROLE,
          name: 'App Ext. Host Name',
          src: FALLBACK_THEME_ZIP,
        },
        adminSession,
      )
    })

    test('should throw a BugError if the theme cannot be created', async () => {
      // Given
      vi.mocked(themeCreate).mockResolvedValue(undefined)

      // When
      // Then
      await expect(themeManager.findOrCreate()).rejects.toThrow(
        'Could not create theme with name "App Ext. Host Name" and role "development"',
      )
      expect(themeCreate).toHaveBeenCalledTimes(4)
    })
  })
})
