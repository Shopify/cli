import adminSpec, {AdminConfigType} from './admin.js'
import {ExtensionInstance} from '../extension-instance.js'
import {inTemporaryDirectory, mkdir, touchFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'

function createAdminExtensionInstance(directory: string, staticRoot?: string): ExtensionInstance<AdminConfigType> {
  return {
    directory,
    configuration: {
      name: 'test-admin',
      type: 'admin',
      admin: staticRoot ? {static_root: staticRoot} : undefined,
    },
  } as unknown as ExtensionInstance<AdminConfigType>
}

describe('admin buildValidation', () => {
  test('passes when static_root is not configured', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const extension = createAdminExtensionInstance(tmpDir, undefined)

      // Should not throw
      await expect(adminSpec.buildValidation!(extension)).resolves.toBeUndefined()
    })
  })

  test('passes when static_root exists and contains index.html', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const distDir = joinPath(tmpDir, 'dist')
      await mkdir(distDir)
      await touchFile(joinPath(distDir, 'index.html'))

      const extension = createAdminExtensionInstance(tmpDir, './dist')

      // Should not throw
      await expect(adminSpec.buildValidation!(extension)).resolves.toBeUndefined()
    })
  })

  test('throws when static_root is configured but index.html is missing', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Create the dist directory but without index.html
      const distDir = joinPath(tmpDir, 'dist')
      await mkdir(distDir)

      const extension = createAdminExtensionInstance(tmpDir, './dist')

      await expect(adminSpec.buildValidation!(extension)).rejects.toThrow(
        'The admin extension requires an index.html file in the static_root directory (./dist), but it was not found.',
      )
    })
  })

  test('throws when static_root directory does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const extension = createAdminExtensionInstance(tmpDir, './dist')

      await expect(adminSpec.buildValidation!(extension)).rejects.toThrow(
        'The admin extension requires an index.html file in the static_root directory (./dist), but it was not found.',
      )
    })
  })
})

describe('admin devSessionWatchConfig', () => {
  test('returns empty paths when static_root is not configured', () => {
    const extension = createAdminExtensionInstance('/tmp/test', undefined)
    const watchConfig = adminSpec.devSessionWatchConfig!(extension)

    expect(watchConfig).toEqual({paths: []})
  })

  test('returns watch paths when static_root is configured', () => {
    const extension = createAdminExtensionInstance('/tmp/test', './dist')
    const watchConfig = adminSpec.devSessionWatchConfig!(extension)

    expect(watchConfig).toBeDefined()
    expect(watchConfig!.paths).toHaveLength(1)
    expect(watchConfig!.paths[0]).toContain('dist')
    expect(watchConfig!.paths[0]).toContain('**/*')
  })
})
