import {renameTheme} from './rename.js'
import {updateTheme} from '@shopify/cli-kit/node/themes/themes-api'
import {Theme} from '@shopify/cli-kit/node/themes/models/theme'
import {test, describe, expect, vi} from 'vitest'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/themes/themes-api')
vi.mock('../utilities/development-theme-manager.js', () => {
  const DevelopmentThemeManager = vi.fn()
  DevelopmentThemeManager.prototype.find = () => theme1
  return {DevelopmentThemeManager}
})

const adminSession = {
  token: 'token',
  storeFqdn: 'my-shop.myshopify.com',
}

const theme1 = {
  id: 1,
  name: 'my theme',
} as Theme

const options = {
  development: false,
  newName: 'Renamed Theme',
}

describe('renameTheme', () => {
  test('renames the development theme', async () => {
    // Given
    // When
    await renameTheme(adminSession, {...options, development: true})

    // Then
    expect(updateTheme).toBeCalledWith(theme1.id, {name: options.newName}, adminSession)
    expect(renderSuccess).toBeCalledWith({
      body: `The theme ${theme1.name} was renamed to ${options.newName}`,
    })
  })
})
