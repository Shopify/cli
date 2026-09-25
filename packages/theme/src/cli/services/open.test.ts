import {open} from './open.js'
import {DevelopmentThemeManager} from '../utilities/development-theme-manager.js'
import {findOrSelectTheme} from '../utilities/theme-selector.js'
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
  test('returns theme details and URLs without opening a browser or rendering', async () => {
    vi.mocked(findOrSelectTheme).mockResolvedValue(theme)

    await expect(open(session, options)).resolves.toEqual({
      theme,
      preview_url: 'https://my-shop.myshopify.com?preview_theme_id=1',
      editor_url: 'https://my-shop.myshopify.com/admin/themes/1/editor',
    })
    expect(openURL).not.toHaveBeenCalled()
    expect(renderInfo).not.toHaveBeenCalled()
  })

  test('propagates theme selection failures', async () => {
    const error = new Error('Theme not found')
    vi.mocked(findOrSelectTheme).mockRejectedValue(error)

    await expect(open(session, options)).rejects.toBe(error)
    expect(openURL).not.toHaveBeenCalled()
    expect(renderInfo).not.toHaveBeenCalled()
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
