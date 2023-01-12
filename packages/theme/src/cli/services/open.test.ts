import {open} from './open.js'
import {findOrSelectTheme} from '../utilities/theme-selector.js'
import {Theme} from '../models/theme.js'
import {test, describe, expect, vi} from 'vitest'
import {system} from '@shopify/cli-kit'
import {renderInfo} from '@shopify/cli-kit/node/ui'

vi.mock('@shopify/cli-kit')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('../utilities/theme-selector.js')

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
    expect(system.open).toBeCalledWith('https://my-shop.myshopify.com?preview_theme_id=1')
  })

  test('opens the editor URL with `editor` flag', async () => {
    // Given
    vi.mocked(findOrSelectTheme).mockResolvedValue(theme)

    // When
    await open(session, {...options, editor: true})

    // Then
    expect(system.open).toBeCalledWith('https://my-shop.myshopify.com/admin/themes/1/editor')
  })

  test('renders the theme links', async () => {
    // Given
    vi.mocked(findOrSelectTheme).mockResolvedValue(theme)

    // When
    await open(session, options)

    // Then
    expect(renderInfo).toBeCalledWith({
      headline: [
        'Preview information for theme my theme',
        {
          subdued: `(#1)`,
        },
      ],
      body: {
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
    })
  })
})
