import {fetchStoreThemes} from './theme-selector/fetch.js'
import {findOrSelectTheme, findThemeById, findThemes, newThemeOption} from './theme-selector.js'
import {getDevelopmentTheme} from '../services/local-storage.js'
import {test, describe, vi, expect} from 'vitest'
import {renderAutocompletePrompt} from '@shopify/cli-kit/node/ui'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {promptThemeName} from '@shopify/cli-kit/node/themes/utils'
import {themeCreate} from '@shopify/cli-kit/node/themes/api'

vi.mock('./theme-selector/fetch.js')
vi.mock('../services/local-storage.js')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/themes/utils')
vi.mock('@shopify/cli-kit/node/themes/api')

const session = {
  token: 'token',
  storeFqdn: 'my-shop.myshopify.com',
}

const storeThemes = [
  mockTheme(1, 'unpublished'),
  mockTheme(2, 'unpublished'),
  mockTheme(3, 'live'),
  mockTheme(4, 'unpublished'),
  mockTheme(5, 'unpublished'),
  mockTheme(6, 'unpublished'),
  mockTheme(7, 'development'),
  mockTheme(8, 'development'),
]

describe('findOrSelectTheme', () => {
  test('returns selected theme when no filter is specified', async () => {
    // Given
    const selectedTheme = storeThemes[0]
    vi.mocked(fetchStoreThemes).mockResolvedValue(storeThemes)
    vi.mocked(renderAutocompletePrompt).mockResolvedValue(() => Promise.resolve(selectedTheme))

    // When
    const theme = await findOrSelectTheme(session, {
      header: 'Select a theme to open',
      filter: {},
    })

    // Then
    expect(theme).toBe(selectedTheme)
  })

  test('flags development theme as [yours]', async () => {
    // Given
    const header = 'Select a theme to open'
    const themes = [mockTheme(7, 'development'), mockTheme(8, 'development')]
    vi.mocked(fetchStoreThemes).mockResolvedValue(themes)
    vi.mocked(renderAutocompletePrompt).mockResolvedValue(() => Promise.resolve(themes[0]))
    vi.mocked(getDevelopmentTheme).mockReturnValue('7')

    // When
    await findOrSelectTheme(session, {
      header,
      filter: {},
    })

    // Then
    expect(renderAutocompletePrompt).toHaveBeenCalledWith({
      message: header,
      choices: [
        expect.objectContaining({group: 'Development', label: 'theme 7 [yours]'}),
        expect.objectContaining({group: 'Development', label: 'theme 8'}),
      ],
    })
  })

  test('returns selected theme when filter is specified', async () => {
    // Given
    vi.mocked(fetchStoreThemes).mockResolvedValue(storeThemes)

    // When
    const theme = await findOrSelectTheme(session, {
      header: 'Select a theme to open',
      filter: {theme: 'theme 2'},
    })

    // Then
    expect(theme).toBe(storeThemes[1])
  })

  test('returns a new theme when users select that option', async () => {
    // Given
    const expectedTheme = mockTheme(42, 'unpublished')
    const expectedThemeName = 'my new theme'

    vi.mocked(renderAutocompletePrompt).mockResolvedValue(newThemeOption(session).value)
    vi.mocked(promptThemeName).mockResolvedValue(expectedThemeName)
    vi.mocked(themeCreate).mockResolvedValue(expectedTheme)
    vi.mocked(fetchStoreThemes).mockResolvedValue(storeThemes)

    // When
    const actualTheme = await findOrSelectTheme(session, {
      create: true,
      header: 'Select a theme to push',
      filter: {},
    })

    // Then
    expect(themeCreate).toBeCalledWith({name: 'my new theme', role: 'unpublished'}, session)
    expect(actualTheme).toBe(expectedTheme)
  })
})

describe('findThemeById', () => {
  test('returns theme when found by ID', async () => {
    // Given
    vi.mocked(fetchStoreThemes).mockResolvedValue(storeThemes)

    // When
    const theme = await findThemeById(session, '3')

    // Then
    expect(theme).toBe(storeThemes[2])
    expect(theme?.id).toBe(3)
    expect(theme?.name).toBe('theme 3')
  })

  test('returns undefined when theme not found', async () => {
    // Given
    vi.mocked(fetchStoreThemes).mockResolvedValue(storeThemes)

    // When
    const theme = await findThemeById(session, '1000')

    // Then
    expect(theme).toBeUndefined()
  })
})

describe('findThemes', () => {
  test('returns selected theme when no filter is specified', async () => {
    // Given
    vi.mocked(fetchStoreThemes).mockResolvedValue(storeThemes)

    // When
    const themes = await findThemes(session, {})

    // Then
    expect(themes).toHaveLength(0)
  })

  test('returns selected themes when filter is specified', async () => {
    // Given
    vi.mocked(fetchStoreThemes).mockResolvedValue(storeThemes)

    // When
    const themes = await findThemes(session, {
      themes: ['theme 2', 'theme 3', 'theme 5'],
    })

    // Then
    expect(themes).toHaveLength(3)
    expect(themes[0]!.name).toEqual('theme 2')
    expect(themes[1]!.name).toEqual('theme 3')
    expect(themes[2]!.name).toEqual('theme 5')
  })
})

function mockTheme(id: number, role: string) {
  return {id, role, name: `theme ${id}`} as Theme
}
