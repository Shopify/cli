import {isVSCode} from './vscode.js'
import {inTemporaryDirectory, mkdir} from './fs.js'
import {joinPath} from './path.js'
import {describe, expect, it} from 'vitest'

describe('isVSCode', () => {
  it('returns true if project has a vscode folder', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await expect(isVSCode(tmpDir)).resolves.toEqual(false)

      await mkdir(joinPath(tmpDir, '.vscode'))

      // When
      const got = await isVSCode(tmpDir)

      // Then
      expect(got).toEqual(true)
    })
  })
})
