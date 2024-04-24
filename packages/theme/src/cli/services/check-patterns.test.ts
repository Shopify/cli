import {checkPatterns} from './check-patterns.js'
import {mountThemeFileSystem} from '../utilities/theme-fs.js'
import {describe, expect, test, vi} from 'vitest'
import {ThemeAsset} from '@shopify/cli-kit/node/themes/types'

vi.mock('../utilities/theme-fs.js')

describe('checkPatterns', () => {
  test('should return a list of theme files that match a given fileignore pattern', async () => {
    // Given
    const path = '/tmp/'
    const patterns = ['config/*.json', 'templates/*.json']
    vi.mocked(mountThemeFileSystem).mockResolvedValue({
      root: '',
      files: new Map<string, ThemeAsset>([
        ['assets/basic.css', {checksum: '123', key: 'assets/basic.css'}],
        ['assets/complex.css', {checksum: '456', key: 'assets/complex.css'}],
        ['assets/image.png', {checksum: '789', key: 'assets/image.png'}],
        ['config/settings_data.json', {checksum: '101', key: 'config/settings_data.json'}],
        ['config/settings_schema.json', {checksum: '112', key: 'config/settings_schema.json'}],
        ['sections/announcement-bar.liquid', {checksum: '131', key: 'sections/announcement-bar.liquid'}],
        ['templates/404.json', {checksum: '141', key: 'templates/404.json'}],
        ['templates/customers/account.json', {checksum: '151', key: 'templates/customers/account.json'}],
      ]),
    })
    // When
    const matches = await checkPatterns(path, patterns)
    // Then
    expect(matches).toEqual({
      'config/*.json': ['config/settings_data.json', 'config/settings_schema.json'],
      'templates/*.json': ['templates/404.json', 'templates/customers/account.json'],
    })
  })
})
