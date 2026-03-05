import {themeInfoJSON, fetchThemeInfo, themeEnvironmentInfoJSON} from './info.js'
import {getDevelopmentTheme, getThemeStore} from './local-storage.js'
import {findOrSelectTheme} from '../utilities/theme-selector.js'
import {DevelopmentThemeManager} from '../utilities/development-theme-manager.js'
import {themePreviewUrl, themeEditorUrl} from '@shopify/cli-kit/node/themes/urls'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {describe, vi, test, expect} from 'vitest'

vi.mock('./local-storage.js')
vi.mock('../utilities/development-theme-manager.js')
vi.mock('../utilities/theme-selector.js', () => {
  return {findOrSelectTheme: vi.fn()}
})

const storeFqdn = 'my-shop.myshopify.com'

const session = {
  token: 'token',
  storeFqdn,
}

const theme = {
  id: 1,
  name: 'my theme',
  role: 'live',
} as Theme

const developmentTheme = {
  id: 2,
  name: 'development theme',
  role: 'development',
} as Theme

const options = {
  store: storeFqdn,
  json: true,
}

describe('info', () => {
  test('generate theme info JSON', () => {
    // When
    const output = themeInfoJSON(theme, session)

    // Then
    expect(output).toHaveProperty('theme.id', theme.id)
    expect(output).toHaveProperty('theme.name', theme.name)
    expect(output).toHaveProperty('theme.shop', session.storeFqdn)
    expect(output).toHaveProperty('theme.preview_url', expect.stringContaining(session.storeFqdn))
    expect(output).toHaveProperty('theme.editor_url', expect.stringContaining(session.storeFqdn))
  })

  test('generate dev info JSON when no theme or dev flag provided', () => {
    // Given
    vi.mocked(getThemeStore).mockReturnValue('my-shop.myshopify.com')
    vi.mocked(getDevelopmentTheme).mockReturnValue(undefined)

    // When
    const output = themeEnvironmentInfoJSON({cliVersion: '3.91.0'})

    // Then
    expect(output).toHaveProperty('store', 'my-shop.myshopify.com')
    expect(output).toHaveProperty('development_theme_id', null)
    expect(output).toHaveProperty('cli_version', '3.91.0')
    expect(output).toHaveProperty('os', expect.stringContaining('-'))
    expect(output).toHaveProperty('shell', process.env.SHELL ?? 'unknown')
    expect(output).toHaveProperty('node_version', process.version)
  })

  test('fetch theme info by id', async () => {
    // Given
    vi.mocked(findOrSelectTheme).mockResolvedValue(theme)

    // When
    const output = await fetchThemeInfo(session, {...options, theme: '1'})

    // Then
    expect(output).toMatchObject({
      theme: {
        ...theme,
        shop: storeFqdn,
        preview_url: themePreviewUrl(theme, session),
        editor_url: themeEditorUrl(theme, session),
      },
    })
  })

  test('fetch development theme info', async () => {
    // Given
    vi.spyOn(DevelopmentThemeManager.prototype, 'findOrCreate').mockResolvedValue(developmentTheme)
    vi.mocked(findOrSelectTheme).mockResolvedValue(developmentTheme)

    // When
    const output = await fetchThemeInfo(session, {...options, development: true})

    // Then
    expect(output).toMatchObject({
      theme: {
        ...developmentTheme,
        shop: storeFqdn,
        preview_url: themePreviewUrl(developmentTheme, session),
        editor_url: themeEditorUrl(developmentTheme, session),
      },
    })
  })
})
