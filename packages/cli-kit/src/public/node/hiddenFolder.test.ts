import {withHiddenConfigPathIn, withHiddenShopifyFolderIn} from './hiddenFolder.js'
import {joinPath} from './path.js'
import {fileExists, inTemporaryDirectory} from './fs.js'
import {describe, test, expect, vi} from 'vitest'
import {execa} from 'execa'

describe(withHiddenShopifyFolderIn, () => {
  test('creates a hidden .shopify folder with a .gitignore file in the given directory', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await gitInit(tmpDir)
      const callbackReturnValue = Symbol('callbackReturnValue')
      const callback = vi.fn().mockReturnValue(callbackReturnValue)
      const expectedHiddenFolder = joinPath(tmpDir, '.shopify')
      const arbitraryHiddenFile = joinPath(expectedHiddenFolder, 'arbitrary-hidden-file')
      const appLevelGitignore = joinPath(tmpDir, '.gitignore')

      // When
      const result = withHiddenShopifyFolderIn(tmpDir, callback)

      // Then
      expect(callback).toHaveBeenCalledWith(expectedHiddenFolder)
      expect(result).toBe(callbackReturnValue)
      await expect(fileExists(expectedHiddenFolder)).resolves.toBe(true)
      await expect(isGitIgnored(tmpDir, arbitraryHiddenFile)).resolves.toBe(true)
      await expect(fileExists(appLevelGitignore)).resolves.toBe(false)
    })
  })
})

describe(withHiddenConfigPathIn, () => {
  test('yields the path to a hidden and gitignored project.json file to the callback', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await gitInit(tmpDir)
      const callbackReturnValue = Symbol('callbackReturnValue')
      const callback = vi.fn().mockReturnValue(callbackReturnValue)
      const expectedHiddenConfigPath = joinPath(tmpDir, '.shopify', 'project.json')
      const appLevelGitignore = joinPath(tmpDir, '.gitignore')

      // When
      const result = withHiddenConfigPathIn(tmpDir, callback)

      // Then
      expect(callback).toHaveBeenCalledWith(expectedHiddenConfigPath)
      expect(result).toBe(callbackReturnValue)
      await expect(isGitIgnored(tmpDir, expectedHiddenConfigPath)).resolves.toBe(true)
      await expect(fileExists(appLevelGitignore)).resolves.toBe(false)
    })
  })
})

function gitInit(dir: string) {
  return execa('git', ['init'], {cwd: dir})
}

async function isGitIgnored(dir: string, path: string) {
  const {stdout} = await execa('git', ['check-ignore', path], {cwd: dir})
  return stdout.trim() === path
}
