import {isEmptyDir} from './pull.js'
import {mkTmpDir, rmdir} from '@shopify/cli-kit/node/fs'
import {test, describe, expect} from 'vitest'

describe('pull', () => {
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
