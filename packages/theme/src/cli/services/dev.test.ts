import {REQUIRED_FOLDERS, validThemeDirectory} from './dev.js'
import {describe, it, expect} from 'vitest'
import {joinPath} from '@shopify/cli-kit/node/path'
import {inTemporaryDirectory, mkdir} from '@shopify/cli-kit/node/fs'

describe('validThemeDirectory', () => {
  it('should not consider an empty directory to be a valid theme directory', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      expect(await validThemeDirectory(tmpDir)).toBe(false)
    })
  })

  it('should not consider an incomplete theme directory to be a valid theme directory', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      await mkdir(joinPath(tmpDir, REQUIRED_FOLDERS[0]!))
      expect(await validThemeDirectory(tmpDir)).toBe(false)
    })
  })

  it('should consider a theme directory to be a valid theme directory', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      await Promise.all(REQUIRED_FOLDERS.map((requiredFolder) => mkdir(joinPath(tmpDir, requiredFolder))))
      expect(await validThemeDirectory(tmpDir)).toBe(true)
    })
  })
})
