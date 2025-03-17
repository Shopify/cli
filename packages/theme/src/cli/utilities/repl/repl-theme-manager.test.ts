import {REPLThemeManager} from './repl-theme-manager.js'
import {setREPLTheme, removeREPLTheme, getREPLTheme, getDevelopmentTheme} from '../../services/local-storage.js'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {DEVELOPMENT_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'
import {bulkUploadThemeAssets, themeCreate, fetchTheme} from '@shopify/cli-kit/node/themes/api'

vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('../../services/local-storage')

describe('REPLThemeManager', () => {
  let adminSession: AdminSession
  let themeManager: REPLThemeManager

  beforeEach(() => {
    adminSession = {storeFqdn: 'mystore.myshopify.com', token: 'token'}
    themeManager = new REPLThemeManager(adminSession)
  })

  describe('create', () => {
    test('should upload theme assets', async () => {
      // Given
      const theme = {
        id: 123,
        name: 'Liquid Console (3.60)',
        role: DEVELOPMENT_THEME_ROLE,
        processing: true,
        createdAtRuntime: true,
      }
      vi.mocked(themeCreate).mockResolvedValue(theme)

      // When
      await themeManager.create(DEVELOPMENT_THEME_ROLE, 'Liquid Console (3.60)')

      // Then
      expect(bulkUploadThemeAssets).toHaveBeenCalledWith(123, expect.any(Array), adminSession)
    })
  })

  test('should set the REPL theme in local storage', async () => {
    // Given
    const themeName = 'Liquid Console (3.60)'
    vi.mocked(themeCreate).mockResolvedValue({
      id: 123,
      name: themeName,
      role: DEVELOPMENT_THEME_ROLE,
      processing: true,
      createdAtRuntime: true,
    })

    // When
    await themeManager.create(DEVELOPMENT_THEME_ROLE, themeName)

    // Then
    expect(setREPLTheme).toHaveBeenCalledWith('123')
  })

  test('should remove the REPL theme from local storage if nothing is found', async () => {
    // Given
    vi.mocked(fetchTheme).mockResolvedValue(undefined)
    vi.mocked(getREPLTheme).mockReturnValue('123')
    themeManager = new REPLThemeManager(adminSession)

    // When
    await themeManager.fetch()

    // Then
    expect(removeREPLTheme).toHaveBeenCalled()
  })

  test('should not conflict with development local storage', async () => {
    // Given
    vi.mocked(getDevelopmentTheme).mockReturnValue('123')
    vi.mocked(getREPLTheme).mockReturnValue('234')
    themeManager = new REPLThemeManager(adminSession)

    // When
    await themeManager.fetch()

    // Then
    expect(fetchTheme).toHaveBeenCalledWith(234, adminSession)
  })
})
