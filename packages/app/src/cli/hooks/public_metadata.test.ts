import gatherPublicMetadata from './public_metadata.js'
import {localAppContext} from '../services/app-context.js'
import metadata from '../metadata.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {cwd, joinPath} from '@shopify/cli-kit/node/path'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'

vi.mock('../services/app-context.js')
vi.mock('@shopify/cli-kit/node/path', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/path')>()
  return {...actual, cwd: vi.fn()}
})

async function inTemporaryAppProject(runTest: (appDirectory: string) => Promise<void>): Promise<void> {
  await inTemporaryDirectory(async (tmpDir) => {
    await writeFile(joinPath(tmpDir, 'shopify.app.toml'), '')
    await runTest(tmpDir)
  })
}

describe('gatherPublicMetadata', () => {
  beforeEach(() => {
    vi.mocked(localAppContext).mockResolvedValue({} as Awaited<ReturnType<typeof localAppContext>>)
  })

  test('opportunistically enriches metadata from the current directory and returns the public metadata', async () => {
    await inTemporaryAppProject(async (appDirectory) => {
      // Given
      vi.mocked(cwd).mockReturnValue(appDirectory)
      vi.spyOn(metadata, 'getAllPublicMetadata').mockReturnValueOnce({}).mockReturnValue({api_key: 'from-loader'})

      // When
      const result = await (gatherPublicMetadata as () => Promise<unknown>)()

      // Then
      expect(localAppContext).toHaveBeenCalledWith({directory: appDirectory, skipPrompts: true})
      expect(result).toEqual(metadata.getAllPublicMetadata())
    })
  })

  test('skips local app loading when api_key is already set', async () => {
    await inTemporaryAppProject(async (appDirectory) => {
      // Given
      vi.mocked(cwd).mockReturnValue(appDirectory)
      vi.spyOn(metadata, 'getAllPublicMetadata').mockReturnValue({api_key: 'already-set'})

      // When
      const result = await (gatherPublicMetadata as () => Promise<unknown>)()

      // Then
      expect(localAppContext).not.toHaveBeenCalled()
      expect(result).toEqual(metadata.getAllPublicMetadata())
    })
  })

  test('skips local app loading when the directory is not inside an app project', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(cwd).mockReturnValue(tmpDir)
      vi.spyOn(metadata, 'getAllPublicMetadata').mockReturnValue({})

      // When
      const result = await (gatherPublicMetadata as () => Promise<unknown>)()

      // Then
      expect(localAppContext).not.toHaveBeenCalled()
      expect(result).toEqual(metadata.getAllPublicMetadata())
    })
  })

  test('still returns metadata when best-effort app loading fails', async () => {
    await inTemporaryAppProject(async (appDirectory) => {
      // Given
      vi.mocked(cwd).mockReturnValue(appDirectory)
      vi.spyOn(metadata, 'getAllPublicMetadata').mockReturnValue({})
      vi.mocked(localAppContext).mockRejectedValue(new Error('not an app'))

      // When
      const result = await (gatherPublicMetadata as () => Promise<unknown>)()

      // Then
      expect(localAppContext).toHaveBeenCalledOnce()
      expect(result).toEqual(metadata.getAllPublicMetadata())
    })
  })
})
