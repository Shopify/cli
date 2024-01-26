import {checksum} from './asset-checksum.js'
import {test, describe, expect} from 'vitest'

describe('normalizeJson', async () => {
  const testCases = [
    {file: 'assets/base.css', expectedChecksum: 'b7fbe0ecff2a6c1d6e697a13096e2b17'},
    {file: 'assets/sparkle.gif', expectedChecksum: '7adcd48a3cc215a81fabd9dafb919507'},
    {file: 'config/settings_data.json', expectedChecksum: '22e69af13b7953914563c60035a831bc'},
    {file: 'config/settings_schema.json', expectedChecksum: '3f6b44e95dbcf0214a0a82627a37cd53'},
    {file: 'layout/password.liquid', expectedChecksum: '7a92d18f1f58b2396c46f98f9e502c6a'},
    {file: 'layout/theme.liquid', expectedChecksum: '2374357fdadd3b4636405e80e21e87fc'},
    {file: 'locales/en.default.json', expectedChecksum: '94d575574a070397f297a2e9bb32ce7d'},
    {file: 'sections/announcement-bar.liquid', expectedChecksum: '3e8fecc3fb5e886f082e12357beb5d56'},
    {file: 'snippets/language-localization.liquid', expectedChecksum: 'aa0c697b712b22753f73c84ba8a2e35a'},
    {file: 'templates/404.json', expectedChecksum: 'f14a0bd594f4fee47b13fc09543098ff'},
  ]

  testCases.forEach(({file, expectedChecksum}) => {
    test(`returns the expected checksum for "${file}"`, async () => {
      // Given
      const root = 'src/cli/utilities/fixtures'

      // When
      const actualChecksum = await checksum(root, file)

      // Then
      expect(actualChecksum).toEqual(expectedChecksum)
    })
  })
})
