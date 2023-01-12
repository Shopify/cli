import {fetchStoreThemes} from './theme-selector/fetch.js'
import {findOrSelectTheme} from '../utilities/theme-selector.js'
import {Theme} from '../models/theme.js'
import {test, describe, vi, expect} from 'vitest'
import {renderSelectPrompt} from '@shopify/cli-kit/node/ui'

vi.mock('./theme-selector/fetch.js')
vi.mock('@shopify/cli-kit/node/ui')

const session = {
  token: 'token',
  storeFqdn: 'my-shop.myshopify.com',
}

const themes = [
  theme(1, 'unpublished'),
  theme(2, 'unpublished'),
  theme(3, 'live'),
  theme(4, 'unpublished'),
  theme(5, 'unpublished'),
  theme(6, 'unpublished'),
  theme(7, 'development'),
  theme(8, 'development'),
]

describe('findOrSelectTheme', () => {
  test('returns selected theme when no filter is specified', async () => {
    // Given
    const selectedTheme = themes[0]
    vi.mocked(fetchStoreThemes).mockResolvedValue(themes)
    vi.mocked(renderSelectPrompt).mockResolvedValue(selectedTheme)

    // When
    const theme = await findOrSelectTheme(session, {
      header: 'Select a theme to open',
      filter: {},
    })

    // Then
    expect(theme).toBe(selectedTheme)
  })

  test('returns selected theme when filter is specified', async () => {
    // Given
    const filteredTheme = themes[1]
    vi.mocked(fetchStoreThemes).mockResolvedValue(themes)

    // When
    const theme = await findOrSelectTheme(session, {
      header: 'Select a theme to open',
      filter: {theme: 'theme 2'},
    })

    // Then
    expect(theme).toBe(filteredTheme)
  })
})

function theme(id: number, role: string) {
  return {id, role, name: `theme ${id}`} as Theme
}
