import {RenameOptions, renameTheme} from './rename.js'
import {findOrSelectTheme} from '../utilities/theme-selector.js'
import {updateTheme} from '@shopify/cli-kit/node/themes/themes-api'
import {Theme} from '@shopify/cli-kit/node/themes/models/theme'
import {test, describe, expect, vi} from 'vitest'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/themes/themes-api')
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
  newName: 'Renamed Theme',
}

describe('renameTheme', () => {
  test('renames the development theme', async () => {
    // Given
    vi.mocked(findOrSelectTheme).mockResolvedValue(developmentTheme)

    // When
    await renameTheme(adminSession, {...options, development: true})

    // Then
    expect(updateTheme).toBeCalledWith(developmentTheme.id, {name: options.newName}, adminSession)
    expect(renderSuccess).toBeCalledWith({
      body: ['The theme', 'my development theme', {subdued: '(#1)'}, 'was renamed to', 'Renamed Theme'],
    })
  })

  test('should rename a theme by ID', async () => {
    // Given
    const theme1 = {
      id: 2,
      name: 'my theme',
    } as Theme

    vi.mocked(findOrSelectTheme).mockResolvedValue(theme1)

    // When
    await renameTheme(adminSession, {...options, theme: '2'})

    // Then
    expect(updateTheme).toBeCalledWith(theme1.id, {name: options.newName}, adminSession)
    expect(renderSuccess).toBeCalledWith({
      body: ['The theme', 'my theme', {subdued: '(#2)'}, 'was renamed to', 'Renamed Theme'],
    })
  })
})
