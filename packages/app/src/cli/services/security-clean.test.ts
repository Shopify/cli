import securityClean, {renderSecurityCleanResult} from './security-clean.js'
import {securityCleanJsonOutputSchema} from './security-clean-json.js'
import {appSecurityArtifactPaths, cleanAllResultsDirectories, cleanResultsDirectory} from './app-security-artifacts.js'
import {fileExists, fileRealPath, inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'
import {joinPath} from '@shopify/cli-kit/node/path'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {describe, expect, test, vi} from 'vitest'
import {symlink} from 'node:fs/promises'
import type {SecurityCleanDependencies} from './security-clean.js'
import type {AppSecuritySelection} from './app-security-selection.js'

async function createApp(directory: string): Promise<AppSecuritySelection> {
  await writeFile(joinPath(directory, 'shopify.app.toml'), 'client_id = "test"\n')
  const appDirectory = await fileRealPath(directory)
  return {kind: 'config', appDirectory, appConfigFilePath: joinPath(appDirectory, 'shopify.app.toml')}
}

async function writeResults(appDirectory: string, resultsKey: string): Promise<string> {
  const paths = appSecurityArtifactPaths(appDirectory, resultsKey)
  await mkdir(paths.resultsDirectory)
  await writeFile(paths.deterministicFindingsPath, '{}\n')
  return paths.resultsDirectory
}

function testDependencies(): SecurityCleanDependencies {
  return {cleanResults: vi.fn(cleanResultsDirectory), cleanAllResults: vi.fn(cleanAllResultsDirectories)}
}

describe('securityClean', () => {
  test('removes only the selected results directory, returns its path, and prints nothing', async () => {
    await inTemporaryDirectory(async (directory) => {
      const selection = await createApp(directory)
      const selectedDirectory = await writeResults(selection.appDirectory, 'shopify.app')
      const otherDirectory = await writeResults(selection.appDirectory, 'shopify.app.production')
      const dependencies = testDependencies()
      const output = mockAndCaptureOutput()
      output.clear()

      const result = await securityClean({all: false, selection}, dependencies)

      expect(result).toStrictEqual({removed: [selectedDirectory]})
      await expect(fileExists(selectedDirectory)).resolves.toBe(false)
      await expect(fileExists(otherDirectory)).resolves.toBe(true)
      expect(dependencies.cleanResults).toHaveBeenCalledWith(selection.appDirectory, 'shopify.app')
      expect(dependencies.cleanAllResults).not.toHaveBeenCalled()
      expect(output.info()).toBe('')
      expect(output.success()).toBe('')
      expect(output.warn()).toBe('')
      expect(output.error()).toBe('')
      output.clear()
    })
  })

  test('removes the results directory of the --client-id key', async () => {
    await inTemporaryDirectory(async (directory) => {
      const selection = {...(await createApp(directory)), clientIdOverride: 'other-client-id'}
      const clientIdDirectory = await writeResults(selection.appDirectory, 'other-client-id')
      const configDirectory = await writeResults(selection.appDirectory, 'shopify.app')

      const result = await securityClean({all: false, selection}, testDependencies())

      expect(result).toStrictEqual({removed: [clientIdDirectory]})
      await expect(fileExists(configDirectory)).resolves.toBe(true)
    })
  })

  test('with all, removes every results directory', async () => {
    await inTemporaryDirectory(async (directory) => {
      const {appDirectory} = await createApp(directory)
      const first = await writeResults(appDirectory, 'shopify.app')
      const second = await writeResults(appDirectory, 'shopify.app.production')
      const dependencies = testDependencies()

      const result = await securityClean({all: true, appDirectory}, dependencies)

      expect([...result.removed].sort()).toStrictEqual([first, second].sort())
      await expect(Promise.all([first, second].map(fileExists))).resolves.toEqual([false, false])
      expect(dependencies.cleanAllResults).toHaveBeenCalledWith(appDirectory)
      expect(dependencies.cleanResults).not.toHaveBeenCalled()
    })
  })

  test('returns an empty list when there is nothing to remove', async () => {
    await inTemporaryDirectory(async (directory) => {
      const selection = await createApp(directory)

      await expect(
        securityClean({all: true, appDirectory: selection.appDirectory}, testDependencies()),
      ).resolves.toEqual({removed: []})
    })
  })

  test('propagates the symlink guard error', async () => {
    await inTemporaryDirectory(async (directory) => {
      await inTemporaryDirectory(async (externalDirectory) => {
        const selection = await createApp(directory)
        await symlink(externalDirectory, joinPath(selection.appDirectory, '.shopify'), 'dir')

        await expect(securityClean({all: false, selection})).rejects.toMatchObject({
          constructor: AbortError,
          message: expect.stringMatching(/symbolic link/),
        })
        await expect(securityClean({all: true, appDirectory: selection.appDirectory})).rejects.toMatchObject({
          constructor: AbortError,
          message: expect.stringMatching(/symbolic link/),
        })
      })
    })
  })
})

describe('securityCleanJsonOutputSchema', () => {
  test('encodes exactly the removed paths', () => {
    const encoded = securityCleanJsonOutputSchema.encode({removed: ['a', 'b']})

    expect(encoded).toBe(['{', '  "removed": [', '    "a",', '    "b"', '  ]', '}'].join('\n'))
  })

  test('encodes an empty list', () => {
    const encoded = securityCleanJsonOutputSchema.encode({removed: []})

    expect(encoded).toBe(['{', '  "removed": []', '}'].join('\n'))
  })

  test('validates a well-formed result and rejects a malformed one', () => {
    const result = {removed: ['a']}
    expect(securityCleanJsonOutputSchema.validate(result)).toStrictEqual(result)
    expect(() => securityCleanJsonOutputSchema.validate({removed: 'a'})).toThrow()
  })
})

describe('renderSecurityCleanResult', () => {
  test('lists every removed path', async () => {
    await inTemporaryDirectory(async (directory) => {
      const {appDirectory} = await createApp(directory)
      const resultsDirectory = await writeResults(appDirectory, 'shopify.app.production')
      const output = mockAndCaptureOutput()
      output.clear()

      renderSecurityCleanResult({removed: [resultsDirectory]}, appDirectory)

      const rendered = output.info()
      expect(rendered).toContain('App security check results removed.')
      expect(rendered).toContain('shopify.app.production')
      output.clear()
    })
  })

  test('notes that there was nothing to remove', async () => {
    await inTemporaryDirectory(async (directory) => {
      const {appDirectory} = await createApp(directory)
      const output = mockAndCaptureOutput()
      output.clear()

      renderSecurityCleanResult({removed: []}, appDirectory)

      const rendered = output.info()
      expect(rendered).toContain('No app security check results to remove.')
      expect(rendered).toContain('app-security')
      output.clear()
    })
  })
})
