import {themeInfoJSON, fetchThemeInfo, themeEnvironmentInfoJSON, renderThemeInfo} from './info.js'
import {getDevelopmentTheme, getThemeStore} from './local-storage.js'
import {DevelopmentThemeManager} from '../utilities/development-theme-manager.js'
import {findOrSelectTheme} from '../utilities/theme-selector.js'
import {themePreviewUrl, themeEditorUrl} from '@shopify/cli-kit/node/themes/urls'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {beforeEach, describe, vi, test, expect} from 'vitest'
import {render, renderInfo} from '@shopify/cli-kit/node/ui'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {render as renderInk} from '@shopify/cli-kit/node/testing/ui'
import {unstyled} from '@shopify/cli-kit/node/output'
import {JSX} from 'react'

vi.mock('./local-storage.js')
vi.mock('../utilities/development-theme-manager.js')
vi.mock('../utilities/theme-selector.js', () => {
  return {findOrSelectTheme: vi.fn()}
})
// Mock only the render entry points; keep the real TokenizedText (and other UI
// components) so the styled view renders link/subdued tokens as it does in prod.
vi.mock('@shopify/cli-kit/node/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/ui')>()
  return {...actual, render: vi.fn(), renderInfo: vi.fn()}
})
vi.mock('@shopify/cli-kit/node/system')

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

  describe('themeEnvironmentInfoJSON', () => {
    test('generate theme environment info JSON', () => {
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

describe('renderThemeInfo', () => {
  const formatted = {
    customSections: [
      {
        title: 'Theme information',
        body: [{subdued: 'Environment name: staging'}],
      },
      {
        title: 'Theme Details',
        body: {
          tabularData: [
            ['Id', '#123'],
            ['Name', 'my theme'],
            ['Editor Url', {link: {url: 'https://my-shop.myshopify.com/editor', label: 'Open in Theme Editor'}}],
          ],
          firstColumnSubdued: true,
        },
      },
    ],
  }

  beforeEach(() => {
    vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
  })

  test('falls back to renderInfo with the original sections when the terminal does not support prompting', async () => {
    vi.mocked(terminalSupportsPrompting).mockReturnValue(false)

    await renderThemeInfo(formatted)

    expect(renderInfo).toHaveBeenCalledWith(formatted)
    expect(render).not.toHaveBeenCalled()
  })

  test('renders styled panels with key/value rows and a link value when the terminal supports prompting', async () => {
    await renderThemeInfo(formatted)

    expect(render).toHaveBeenCalledOnce()
    expect(renderInfo).not.toHaveBeenCalled()

    const view = vi.mocked(render).mock.calls[0]![0] as JSX.Element
    const {lastFrame} = renderInk(view)
    const frame = unstyled(lastFrame()!)
    expect(frame).toMatchInlineSnapshot(`
      "╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
      │                                                                                                  │
      │  Theme information                                                                               │
      │  Environment name: staging                                                                       │
      │                                                                                                  │
      ╰──────────────────────────────────────────────────────────────────────────────────────────────────╯

      ╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
      │                                                                                                  │
      │  Theme Details                                                                                   │
      │  Id          #123                                                                                │
      │  Name        my theme                                                                            │
      │  Editor Url  Open in Theme Editor                                                                │
      │               ( https://my-shop.m                                                                │
      │              yshopify.com/editor                                                                 │
      │              )                                                                                   │
      │                                                                                                  │
      ╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
      "
    `)
    expect(frame).toContain('Environment name: staging')
    expect(frame).toContain('Theme Details')
    expect(frame).toContain('Open in Theme Editor')
  })
})
