import {getOrCreateHiddenShopifyFolder} from './hidden-folder.js'
import {joinPath} from './path.js'
import * as fs from './fs.js'
import {describe, expect, test, vi} from 'vitest'

describe('getOrCreateHiddenShopifyFolder', () => {
  test('creates hidden .shopify folder and returns its path', async () => {
    await fs.inTemporaryDirectory(async (tmpDir) => {
      // When
      const result = await getOrCreateHiddenShopifyFolder(tmpDir)
      const expectedFolder = joinPath(tmpDir, '.shopify')

      // Then
      expect(result).toBe(expectedFolder)
      await expect(fs.fileExists(expectedFolder)).resolves.toBe(true)
    })
  })

  test('creates .gitignore file in the hidden folder', async () => {
    await fs.inTemporaryDirectory(async (tmpDir) => {
      // When
      await getOrCreateHiddenShopifyFolder(tmpDir)
      const hiddenFolder = joinPath(tmpDir, '.shopify')
      const gitignorePath = joinPath(hiddenFolder, '.gitignore')

      // Then
      await expect(fs.fileExists(gitignorePath)).resolves.toBe(true)
      const gitignoreContent = await fs.readFile(gitignorePath)
      expect(gitignoreContent).toContain('# Ignore the entire .shopify directory')
      expect(gitignoreContent).toContain('*')
    })
  })

  test('does not recreate the folder or .gitignore if they already exist', async () => {
    await fs.inTemporaryDirectory(async (tmpDir) => {
      // Given
      await fs.mkdir(joinPath(tmpDir, '.shopify'))
      await fs.writeFile(joinPath(tmpDir, '.shopify', '.gitignore'), 'test')
      const mkdirSpy = vi.spyOn(fs, 'mkdir')
      const writeFileSpy = vi.spyOn(fs, 'writeFile')

      // When
      await getOrCreateHiddenShopifyFolder(tmpDir)

      // Then
      expect(mkdirSpy).not.toHaveBeenCalled()
      expect(writeFileSpy).not.toHaveBeenCalled()
    })
  })
})
