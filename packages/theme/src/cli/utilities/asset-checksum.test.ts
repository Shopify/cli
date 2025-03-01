import {calculateChecksum, rejectGeneratedStaticAssets} from './asset-checksum.js'
import {readThemeFile} from './theme-fs.js'
import {describe, expect, test} from 'vitest'
import {joinPath, dirname} from '@shopify/cli-kit/node/path'
import {fileURLToPath} from 'node:url'

describe('asset-checksum', () => {
  const locationOfThisFile = dirname(fileURLToPath(import.meta.url))

  describe('calculateChecksum', async () => {
    const testCases = [
      {file: 'assets/base.css', expectedChecksum: 'b7fbe0ecff2a6c1d6e697a13096e2b17'},
      {file: 'assets/sparkle.gif', expectedChecksum: '7adcd48a3cc215a81fabd9dafb919507'},
      {file: 'config/settings_data.json', expectedChecksum: '22e69af13b7953914563c60035a831bc'},
      {file: 'config/settings_schema.json', expectedChecksum: 'cbe979d3fd3b7cdf2041ada9fdb3af57'},
      {file: 'layout/password.liquid', expectedChecksum: '7a92d18f1f58b2396c46f98f9e502c6a'},
      {file: 'layout/theme.liquid', expectedChecksum: '2374357fdadd3b4636405e80e21e87fc'},
      {file: 'locales/en.default.json', expectedChecksum: '0b2f0aa705a4eb2b4740e2ed68bc043f'},
      {file: 'sections/announcement-bar.liquid', expectedChecksum: '3e8fecc3fb5e886f082e12357beb5d56'},
      {file: 'snippets/language-localization.liquid', expectedChecksum: 'aa0c697b712b22753f73c84ba8a2e35a'},
      {file: 'templates/404.json', expectedChecksum: '64caf742bd427adcf497bffab63df30c'},
    ]
    testCases.forEach(({file, expectedChecksum}) => {
      test(`returns the expected checksum for "${file}"`, async () => {
        // Given
        const root = joinPath(locationOfThisFile, 'fixtures/theme')
        const content = await readThemeFile(root, file)

        // When
        const actualChecksum = await calculateChecksum(file, content)

        // Then
        expect(actualChecksum).toEqual(expectedChecksum)
      })
    })
  })

  describe('rejectLiquidChecksums', () => {
    test('filters out generated asset files from a list of theme checksums.', async () => {
      // Given
      const themeChecksums = [
        {key: 'assets/basic.css', checksum: '00000000000000000000000000000000'},
        {key: 'assets/basic.css.liquid', checksum: '00000000000000000000000000000000'},
        {key: 'assets/complex.css', checksum: '11111111111111111111111111111111'},
        {key: 'assets/image.png', checksum: '22222222222222222222222222222222'},
        {key: 'config/settings_data.json', checksum: '33333333333333333333333333333333'},
        {key: 'config/settings_schema.json', checksum: '44444444444444444444444444444444'},
        {key: 'sections/announcement-bar.liquid', checksum: '55555555555555555555555555555555'},
      ]

      // When
      const result = rejectGeneratedStaticAssets(themeChecksums)

      // Then
      expect(result).toEqual([
        {key: 'assets/basic.css.liquid', checksum: '00000000000000000000000000000000'},
        {key: 'assets/complex.css', checksum: '11111111111111111111111111111111'},
        {key: 'assets/image.png', checksum: '22222222222222222222222222222222'},
        {key: 'config/settings_data.json', checksum: '33333333333333333333333333333333'},
        {key: 'config/settings_schema.json', checksum: '44444444444444444444444444444444'},
        {key: 'sections/announcement-bar.liquid', checksum: '55555555555555555555555555555555'},
      ])
    })
  })
})
