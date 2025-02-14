import {themeInfoJSON, fetchThemeInfo, formatThemeInfo} from './info.js'
import {findOrSelectTheme} from '../utilities/theme-selector.js'
import {DevelopmentThemeManager} from '../utilities/development-theme-manager.js'
import {themePreviewUrl, themeEditorUrl} from '@shopify/cli-kit/node/themes/urls'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {describe, vi, test, expect, beforeEach, afterEach} from 'vitest'
import {formatSection} from '@shopify/cli-kit/node/output'

vi.mock('../utilities/development-theme-manager.js')
vi.mock('../utilities/theme-selector.js', () => {
  return {findOrSelectTheme: vi.fn()}
})

vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/output')>()
  return {
    ...actual,
    formatSection: vi.fn((key, val) => `${key}: ${val}`),
    consoleLog: vi.fn(),
    consoleWarn: vi.fn(),
    consoleError: vi.fn(),
    outputToken: {
      raw: vi.fn(),
      cyan: vi.fn(),
    },
    outputContent: vi.fn(),
  }
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

describe('formatThemeInfo', () => {
  beforeEach(() => {
    vi.mocked(formatSection).mockImplementation((key, val) => `${key}: ${val}`)
  })

  afterEach(() => {
    // eslint-disable-next-line @shopify/cli/no-vi-manual-mock-clear
    vi.clearAllMocks()
  })

  test('formats theme info with environment flag', async () => {
    // Given
    const themeInfo = {
      theme: {
        id: 1234,
        name: 'Test Theme',
        role: 'development',
        shop: 'test-shop.myshopify.com',
        editor_url: 'https://test-shop.myshopify.com/editor',
        preview_url: 'https://test-shop.myshopify.com/preview',
      },
    }

    // When
    const result = await formatThemeInfo(themeInfo, {environment: 'production'})

    // Then
    expect(result).toEqual({
      customSections: [
        {
          title: 'Theme information',
          body: [{subdued: 'Environment name: production'}],
        },
        {
          title: '',
          body: [
            'id: 1234',
            'name: Test Theme',
            'role: development',
            'shop: test-shop.myshopify.com',
            'editor_url: https://test-shop.myshopify.com/editor',
            'preview_url: https://test-shop.myshopify.com/preview',
          ].join('\n\n'),
        },
      ],
    })

    expect(formatSection).toHaveBeenCalledTimes(6)
  })
})
