import {isEmptyDir, rejectLiquidChecksums} from './pull.js'
import {mkTmpDir, rmdir} from '@shopify/cli-kit/node/fs'
import {test, describe, expect} from 'vitest'

describe('pull', () => {
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
      const result = rejectLiquidChecksums(themeChecksums)

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

  describe('isEmptyDir', () => {
    test('returns true when directory is empty', async () => {
      // Given
      const root = 'src/cli/utilities/fixtures'

      // When
      const result = await isEmptyDir(root)

      // Then
      expect(result).toBeFalsy()
    })

    test(`returns false when directory is not empty`, async () => {
      // Given
      const root = await mkTmpDir()

      // When
      const result = await isEmptyDir(root)

      // Then
      expect(result).toBeTruthy()
      await rmdir(root)
    })
  })
})
