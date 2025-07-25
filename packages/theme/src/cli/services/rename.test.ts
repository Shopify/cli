import {RenameOptions, renameTheme} from './rename.js'
import {findOrSelectTheme} from '../utilities/theme-selector.js'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {test, describe, expect, vi} from 'vitest'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {themeUpdate} from '@shopify/cli-kit/node/themes/api'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('../utilities/theme-selector.js', () => {
  return {findOrSelectTheme: vi.fn()}
})

const adminSession = {
  token: 'token',
  storeFqdn: 'my-shop.myshopify.com',
}

const developmentTheme = {
  id: 1,
  name: 'my development theme',
} as Theme

const options: RenameOptions = {
  development: false,
  name: 'Renamed Theme',
  live: false,
}

describe('renameTheme', () => {
  test('calls themeUpdate with the development flag', async () => {
    // Given
    vi.mocked(findOrSelectTheme).mockResolvedValue(developmentTheme)

    // When
    await renameTheme({...options, development: true}, adminSession)

    // Then
    expect(themeUpdate).toBeCalledWith(developmentTheme.id, {name: options.name}, adminSession)
    expect(renderSuccess).toBeCalledWith({
      body: ['The theme', "'my development theme'", {subdued: '(#1)'}, 'was renamed to', "'Renamed Theme'"],
    })
  })

  test('calls themeUpdate with a theme ID', async () => {
    // Given
    const theme1 = {
      id: 2,
      name: 'my theme',
    } as Theme

    vi.mocked(findOrSelectTheme).mockResolvedValue(theme1)

    // When
    await renameTheme({...options, theme: '2'}, adminSession)

    // Then
    expect(themeUpdate).toBeCalledWith(theme1.id, {name: options.name}, adminSession)
    expect(renderSuccess).toBeCalledWith({
      body: ['The theme', "'my theme'", {subdued: '(#2)'}, 'was renamed to', "'Renamed Theme'"],
    })
  })

  test('calls themeUpdate with the live flag', async () => {
    // Given
    const theme1 = {
      id: 2,
      name: 'live theme',
    } as Theme

    vi.mocked(findOrSelectTheme).mockResolvedValue(theme1)

    // When
    await renameTheme({...options, live: true}, adminSession)

    // Then
    expect(themeUpdate).toBeCalledWith(theme1.id, {name: options.name}, adminSession)
    expect(renderSuccess).toBeCalledWith({
      body: ['The theme', "'live theme'", {subdued: '(#2)'}, 'was renamed to', "'Renamed Theme'"],
    })
  })
})
