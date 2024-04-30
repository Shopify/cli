import {UnpublishedThemeManager} from './unpublished-theme-manager.js'
import {createTheme} from '@shopify/cli-kit/node/themes/api'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {UNPUBLISHED_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/themes/api')

describe('UnpublishedThemeManager', () => {
  const storeFqdn = 'mystore.myshopify.com'
  const token = 'token'
  const newThemeId = 201

  describe('create', () => {
    beforeEach(() => {
      vi.mocked(createTheme).mockImplementation(({name, role}) =>
        Promise.resolve(
          buildTheme({
            id: newThemeId,
            name: name!,
            role: role!,
          })!,
        ),
      )
    })

    test('creates an unpublished theme by default', async () => {
      // Given
      const themeManager = buildThemeManager()

      // When
      const theme = await themeManager.create()

      // Then
      expect(theme.role).toBe(UNPUBLISHED_THEME_ROLE)
    })
  })

  function buildThemeManager(): UnpublishedThemeManager {
    return new UnpublishedThemeManager({
      storeFqdn,
      token,
    })
  }
})
