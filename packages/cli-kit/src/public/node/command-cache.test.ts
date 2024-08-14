import {
  clearCachedCommandInfo,
  CommandCacheOptions,
  getCachedCommandInfo,
  runWithCommandCache,
  setCachedCommandInfo,
} from './command-cache.js'
import {joinPath} from './path.js'
import {describe, expect, test, vi} from 'vitest'
import {inTemporaryDirectory, readFile, writeFile} from '@shopify/cli-kit/node/fs'

describe('setCachedCommandInfo', () => {
  test('saves the data in the expected file under the current command ID', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const options: CommandCacheOptions = {commandId: 'my-command', cwd}
      const cacheFile = joinPath(cwd, 'config.json')

      // When
      setCachedCommandInfo({name: 'gonzalo'}, options)

      // Then
      const expectedResult = `{
	"my-command": {
		"name": "gonzalo"
	}
}`
      const result = await readFile(cacheFile)
      expect(result).toEqual(expectedResult)
    })
  })
})

describe('getCachedCommandInfo', () => {
  test('reads the data for the current command ID', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const options: CommandCacheOptions = {commandId: 'my-command', cwd}
      const cacheFile = joinPath(cwd, 'config.json')
      const fileContent = `{ "my-command": { "name": "gonzalo" } }`
      await writeFile(cacheFile, fileContent)

      // When
      const result = getCachedCommandInfo(options)

      // Then
      expect(result!.name).toEqual('gonzalo')
    })
  })

  test('returns undefined when the command ID is not found', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const options: CommandCacheOptions = {commandId: 'my-command', cwd}
      const cacheFile = joinPath(cwd, 'config.json')
      const fileContent = `{ "another-command": { "name": "gonzalo" } }`
      await writeFile(cacheFile, fileContent)

      // When
      const result = getCachedCommandInfo(options)

      // Then
      expect(result).toBeUndefined()
    })
  })
})

describe('clearCachedCommandInfo', () => {
  test('removes the data for the current command ID', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const cacheFile = joinPath(cwd, 'config.json')
      const fileContent = `{ "my-command": { "name": "gonzalo" } }`
      await writeFile(cacheFile, fileContent)

      // When
      clearCachedCommandInfo(cwd)

      // Then
      const result = await readFile(cacheFile)
      expect(result).toEqual('{}')
    })
  })
})

describe('runWithCommandCache', () => {
  test('stores the result of the function when it is not cached', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const options: CommandCacheOptions = {commandId: 'my-command', cwd}
      const cacheFile = joinPath(cwd, 'config.json')

      // When
      const result = await runWithCommandCache('my-key', () => 'my-value', options)

      // Then
      expect(result).toEqual('my-value')
      const cacheContent = await readFile(cacheFile)
      const expectedContent = `{
	"my-command": {
		"my-key": "my-value"
	}
}`
      expect(cacheContent).toEqual(expectedContent)
    })
  })

  test('does not run the function when the result is already cached', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const options: CommandCacheOptions = {commandId: 'my-command', cwd}
      const cacheFile = joinPath(cwd, 'config.json')
      const fileContent = `{
        "my-command": {
          "my-key": "old-value"
        }
      }`
      await writeFile(cacheFile, fileContent)
      const fn = vi.fn(() => 'new-value')

      // When
      const result = await runWithCommandCache('my-key', fn, options)

      // Then
      expect(fn).not.toHaveBeenCalled()
      expect(result).toEqual('old-value')
      const cacheContent = await readFile(cacheFile)
      const expectedContent = `{
        "my-command": {
          "my-key": "old-value"
        }
      }`
      expect(cacheContent).toEqual(expectedContent)
    })
  })

  test('returns the cached values when required', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const options: CommandCacheOptions = {commandId: 'my-command', cwd}

      // When
      const result1 = await runWithCommandCache('my-key', () => '1', options)
      const result2 = await runWithCommandCache('my-key', () => '2', options)
      const result3 = await runWithCommandCache('other-key', () => '3', options)

      // Then
      expect(result1).toEqual('1')
      expect(result2).toEqual('1')
      expect(result3).toEqual('3')
    })
  })
})
