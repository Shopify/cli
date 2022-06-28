import {join} from './path.js'
import {mkdir} from './file.js'
import {isVSCode} from './vscode.js'
import {describe, expect, it} from 'vitest'
import {temporaryDirectory} from '@shopify/cli-testing/temporary'

describe('isVSCode', () => {
  it('returns true if project has a vscode folder', async () => {
    await temporaryDirectory(async (tmpDir) => {
      // Given
      await expect(isVSCode(tmpDir)).resolves.toEqual(false)

      await mkdir(join(tmpDir, '.vscode'))

      // When
      const got = await isVSCode(tmpDir)

      // Then
      expect(got).toEqual(true)
    })
  })
})
