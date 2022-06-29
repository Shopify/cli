import {join} from './path.js'
import {inTemporaryDirectory, mkdir} from './file.js'
import {isVSCode} from './vscode.js'
import {describe, expect, it} from 'vitest'

describe('isVSCode', () => {
  it('returns true if project has a vscode folder', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
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
