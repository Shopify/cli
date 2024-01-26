import {open} from './open.js'
import {findOrSelectTheme} from '../utilities/theme-selector.js'
import {DevelopmentThemeManager} from '../utilities/development-theme-manager.js'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {test, describe, expect, vi, beforeEach} from 'vitest'
import {openURL} from '@shopify/cli-kit/node/system'
import {renderInfo} from '@shopify/cli-kit/node/ui'

vi.mock('@shopify/cli-kit/node/system', () => {
  return {openURL: vi.fn()}
})
vi.mock('@shopify/cli-kit/node/ui', () => {
  return {renderInfo: vi.fn()}
})
vi.mock('../utilities/development-theme-manager.js')
vi.mock('../utilities/theme-selector.js', () => {
  return {findOrSelectTheme: vi.fn()}
})

const session = {
  token: 'token',
  storeFqdn: 'my-shop.myshopify.com',
}

const theme = {
  id: 1,
  name: 'my theme',
} as Theme

const developmentTheme = {
  id: 2,
  name: 'development theme',
} as Theme

const options = {
  development: false,
  live: false,
  editor: false,
  theme: '1',
}

describe('open', () => {
  test('opens the preview URL', async () => {
    // Given
    vi.mocked(findOrSelectTheme).mockResolvedValue(theme)

    // When
    await open(session, options)

    // Then
    expect(openURL).toBeCalledWith('https://my-shop.myshopify.com?preview_theme_id=1')
  })

  test('opens the editor URL with `editor` flag', async () => {
    // Given
    vi.mocked(findOrSelectTheme).mockResolvedValue(theme)

    // When
    await open(session, {...options, editor: true})

    // Then
    expect(openURL).toBeCalledWith('https://my-shop.myshopify.com/admin/themes/1/editor')
  })

  test('renders the theme links', async () => {
    // Given
    vi.spyOn(DevelopmentThemeManager.prototype, 'fetch').mockResolvedValue(theme)
    vi.mocked(findOrSelectTheme).mockResolvedValue(theme)

    // When
    await open(session, options)

    // Then
    expect(renderInfo).toBeCalledWith({
      body: [
        'Preview information for theme',
        'my theme',
        {subdued: '(#1)'},
        '\n\n',
        {
          list: {
            items: [
              {
                link: {
                  label: 'Preview your theme',
                  url: 'https://my-shop.myshopify.com?preview_theme_id=1',
                },
              },
              {
                link: {
                  label: 'Customize your theme at the theme editor',
                  url: 'https://my-shop.myshopify.com/admin/themes/1/editor',
                },
              },
            ],
          },
        },
      ],
    })
  })

  describe('findOrSelectTheme', () => {
    const header = 'Select a theme to open'
    const live = options.live

    beforeEach(() => {
      vi.mocked(findOrSelectTheme).mockResolvedValue(theme)
    })

    test('should call with no development theme and no theme to filter', async () => {
      vi.spyOn(DevelopmentThemeManager.prototype, 'fetch').mockResolvedValue(undefined)

      await open(session, {...options, theme: undefined})

      expect(findOrSelectTheme).toHaveBeenCalledWith(session, {
        header,
        filter: {
          live,
          theme: undefined,
        },
      })
    })

    test('should call with development theme and theme to filter', async () => {
      vi.spyOn(DevelopmentThemeManager.prototype, 'fetch').mockResolvedValue(developmentTheme)

      await open(session, options)

      expect(findOrSelectTheme).toHaveBeenCalledWith(session, {
        header,
        filter: {
          live,
          theme: options.theme,
        },
      })
    })

    test('should call with development theme to filter', async () => {
      vi.spyOn(DevelopmentThemeManager.prototype, 'find').mockResolvedValue(developmentTheme)

      await open(session, {...options, development: true})

      expect(findOrSelectTheme).toHaveBeenCalledWith(session, {
        header,
        filter: {
          live,
          theme: developmentTheme.id.toString(),
        },
      })
    })
  })
})
