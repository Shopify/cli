import {open} from './open.js'
import {findOrSelectTheme} from '../utilities/theme-selector.js'
import {Theme} from '@shopify/cli-kit/node/themes/models/theme'
import {test, describe, expect, vi} from 'vitest'
import {openURL} from '@shopify/cli-kit/node/system'
import {renderInfo} from '@shopify/cli-kit/node/ui'

vi.mock('@shopify/cli-kit/node/system', () => {
  return {openURL: vi.fn()}
})
vi.mock('@shopify/cli-kit/node/ui', () => {
  return {renderInfo: vi.fn()}
})
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
})
