import {join} from './path'
import {mkdir} from './file'
import {isVSCode} from './vscode'
import {describe, expect, it} from 'vitest'
import {temporary} from '@shopify/cli-testing'

describe('isVSCode', () => {
  it('returns true if project has a vscode folder', async () => {
    await temporary.directory(async (tmpDir) => {
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
