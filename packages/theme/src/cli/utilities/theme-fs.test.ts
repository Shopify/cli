import {
  handleSyncUpdate,
  hasRequiredThemeDirectories,
  isJson,
  isTextFile,
  isThemeAsset,
  mountThemeFileSystem,
  partitionThemeFiles,
  readThemeFile,
} from './theme-fs.js'
import {fileExistsNoFollow} from './theme-file-path.js'
import {getPatternsFromShopifyIgnore, applyIgnoreFilters} from './asset-ignore.js'
import {triggerBrowserFullReload} from './theme-environment/hot-reload/server.js'
import {
  writeFile,
  inTemporaryDirectory,
  copyDirectoryContents,
  fileExists,
  readFile,
  mkdir,
  symlink,
} from '@shopify/cli-kit/node/fs'
import * as fsKit from '@shopify/cli-kit/node/fs'
import {test, describe, expect, vi, beforeEach} from 'vitest'
import chokidar from 'chokidar'
import {bulkUploadThemeAssets, deleteThemeAssets, fetchThemeAssets} from '@shopify/cli-kit/node/themes/api'
import {renderError} from '@shopify/cli-kit/node/ui'
import {Operation, type Checksum, type ThemeAsset} from '@shopify/cli-kit/node/themes/types'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {recordError} from '@shopify/cli-kit/node/analytics'
import {AbortError} from '@shopify/cli-kit/node/error'
import {AdminSession} from '@shopify/cli-kit/node/session'

import EventEmitter from 'events'
import {fileURLToPath} from 'node:url'

vi.mock('./asset-ignore.js')
vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/output')
vi.mock('@shopify/cli-kit/node/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/analytics')>()
  return {
    ...actual,
    recordError: vi.fn(),
  }
})
vi.mock('./theme-environment/hot-reload/server.js')

beforeEach(async () => {
  vi.mocked(getPatternsFromShopifyIgnore).mockResolvedValue([])
  const realModule = await vi.importActual<typeof import('./asset-ignore.js')>('./asset-ignore.js')
  vi.mocked(applyIgnoreFilters).mockImplementation(realModule.applyIgnoreFilters)
})

describe('theme-fs', () => {
  const locationOfThisFile = dirname(fileURLToPath(import.meta.url))

  test('treats a child of a regular file as a missing entry', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, 'file.txt')
      await writeFile(filePath, 'content')

      await expect(fileExistsNoFollow(joinPath(filePath, 'child.txt'))).resolves.toBe(false)
    })
  })

  describe('mountThemeFileSystem', async () => {
    test('mounts the local theme file system when the directory is valid', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const root = tmpDir
        await copyDirectoryContents(joinPath(locationOfThisFile, 'fixtures/theme'), root)

        // When
        const themeFileSystem = mountThemeFileSystem(root)
        await themeFileSystem.ready()

        // Then
        expect(themeFileSystem.root).toBe(root)
        expect(themeFileSystem.files.size).toBe(13)
        expect(themeFileSystem.unsyncedFileKeys).toEqual(new Set())
        expect(themeFileSystem.uploadErrors).toEqual(new Map())

        // Check that all expected files are present with correct checksums
        const expectedFiles = [
          {checksum: '6e3520cc5a5c4cdb1267f36406c732a1', key: 'AGENTS.md'},
          {checksum: 'f5e9ce97aef578fc4e2e369a3c271234', key: 'DESIGN.md'},
          {checksum: 'b7fbe0ecff2a6c1d6e697a13096e2b17', key: 'assets/base.css'},
          {checksum: '7adcd48a3cc215a81fabd9dafb919507', key: 'assets/sparkle.gif'},
          {checksum: '22e69af13b7953914563c60035a831bc', key: 'config/settings_data.json'},
          {checksum: 'cbe979d3fd3b7cdf2041ada9fdb3af57', key: 'config/settings_schema.json'},
          {checksum: '98fb75d10c4dbf239997ae494581fd7d', key: 'config/styles.css'},
          {checksum: '7a92d18f1f58b2396c46f98f9e502c6a', key: 'layout/password.liquid'},
          {checksum: '2374357fdadd3b4636405e80e21e87fc', key: 'layout/theme.liquid'},
          {checksum: '0b2f0aa705a4eb2b4740e2ed68bc043f', key: 'locales/en.default.json'},
          {checksum: '3e8fecc3fb5e886f082e12357beb5d56', key: 'sections/announcement-bar.liquid'},
          {checksum: 'aa0c697b712b22753f73c84ba8a2e35a', key: 'snippets/language-localization.liquid'},
          {checksum: '64caf742bd427adcf497bffab63df30c', key: 'templates/404.json'},
        ]

        for (const expectedFile of expectedFiles) {
          const file = themeFileSystem.files.get(expectedFile.key)
          expect(file).toBeDefined()
          expect(file!.key).toBe(expectedFile.key)
          expect(file!.checksum).toBe(expectedFile.checksum)
          expect(typeof file!.value).toBe('string')
          expect(typeof file!.attachment).toBe('string')
          expect(typeof file!.stats?.size).toBe('number')
          expect(typeof file!.stats?.mtime).toBe('number')
        }

        // Check functions exist
        expect(typeof themeFileSystem.ready).toBe('function')
        expect(typeof themeFileSystem.delete).toBe('function')
        expect(typeof themeFileSystem.write).toBe('function')
        expect(typeof themeFileSystem.read).toBe('function')
        expect(typeof themeFileSystem.applyIgnoreFilters).toBe('function')
        expect(typeof themeFileSystem.addEventListener).toBe('function')
        expect(typeof themeFileSystem.startWatcher).toBe('function')
      })
    })

    test('mounts an empty file system when the directory is invalid', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const root = joinPath(tmpDir, 'invalid-directory')

        // When
        const themeFileSystem = mountThemeFileSystem(root)
        await themeFileSystem.ready()

        // Then
        expect(themeFileSystem).toEqual({
          root,
          files: new Map(),
          unsyncedFileKeys: new Set(),
          uploadErrors: new Map(),
          ready: expect.any(Function),
          delete: expect.any(Function),
          write: expect.any(Function),
          read: expect.any(Function),
          applyIgnoreFilters: expect.any(Function),
          addEventListener: expect.any(Function),
          startWatcher: expect.any(Function),
        })
      })
    })

    test('includes listing directory in watched directories when listing is specified', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const root = tmpDir
        await copyDirectoryContents(joinPath(locationOfThisFile, 'fixtures/theme'), root)
        const watchSpy = vi.spyOn(chokidar, 'watch').mockReturnValue(new EventEmitter() as any)

        // When
        const themeFileSystem = mountThemeFileSystem(root, {listing: 'modern'})
        await themeFileSystem.ready()
        await themeFileSystem.startWatcher('123', {token: 'token'} as any)

        // Then
        expect(watchSpy).toHaveBeenCalledWith(
          expect.arrayContaining([joinPath(root, 'listings', 'modern')]),
          expect.any(Object),
        )
      })
    })

    test('does not include listing directory when no listing is specified', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const root = tmpDir
        await copyDirectoryContents(joinPath(locationOfThisFile, 'fixtures/theme'), root)
        const watchSpy = vi.spyOn(chokidar, 'watch').mockReturnValue(new EventEmitter() as any)

        // When
        const themeFileSystem = mountThemeFileSystem(root)
        await themeFileSystem.ready()
        await themeFileSystem.startWatcher('123', {token: 'token'} as any)

        // Then
        const watchedPaths = watchSpy.mock.calls[0]?.[0] as string[]
        expect(watchedPaths.some((path) => path.includes('listings'))).toBe(false)
      })
    })

    test('"delete" removes the file from the local disk and updates the file map', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const root = tmpDir
        await copyDirectoryContents(joinPath(locationOfThisFile, 'fixtures/theme'), root)

        // When
        const themeFileSystem = mountThemeFileSystem(root)
        await themeFileSystem.ready()
        await themeFileSystem.delete('assets/base.css')

        // Then
        await expect(fileExists(joinPath(root, 'assets/base.css'))).resolves.toBe(false)
        expect(themeFileSystem.files.has('assets/base.css')).toBe(false)
      })
    })
  })

  describe('themeFileSystem.delete', () => {
    test.each(['.', './', './.'])('rejects %s before deleting the theme directory', async (key) => {
      await inTemporaryDirectory(async (tmpDir) => {
        const root = joinPath(tmpDir, 'theme')
        const sentinelPath = joinPath(root, 'sentinel.txt')
        await mkdir(root)
        await writeFile(sentinelPath, 'untouched')
        const themeFileSystem = mountThemeFileSystem(root)
        await themeFileSystem.ready()

        await expect(themeFileSystem.delete(key)).rejects.toThrow(AbortError)

        await expect(readFile(sentinelPath)).resolves.toBe('untouched')
      })
    })

    test('rejects traversal before changing the map or removing an outside file', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const root = joinPath(tmpDir, 'theme')
        const outsidePath = joinPath(tmpDir, 'outside.txt')
        await mkdir(root)
        await writeFile(outsidePath, 'untouched')
        const themeFileSystem = mountThemeFileSystem(root)
        await themeFileSystem.ready()
        const asset = {key: '../outside.txt', checksum: '1010', value: 'untouched'}
        themeFileSystem.files.set(asset.key, asset)

        await expect(themeFileSystem.delete(asset.key)).rejects.toThrow(AbortError)

        expect(themeFileSystem.files.get(asset.key)).toEqual(asset)
        await expect(readFile(outsidePath)).resolves.toBe('untouched')
      })
    })

    test('"delete" removes the file from the local disk and updates the file map', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const root = tmpDir
        await copyDirectoryContents(joinPath(locationOfThisFile, 'fixtures/theme'), root)

        // When
        const themeFileSystem = mountThemeFileSystem(root)
        await themeFileSystem.ready()
        expect(themeFileSystem.files.has('assets/base.css')).toBe(true)
        await themeFileSystem.delete('assets/base.css')

        // Then
        await expect(fileExists(joinPath(root, 'assets/base.css'))).resolves.toBe(false)
        expect(themeFileSystem.files.has('assets/base.css')).toBe(false)
      })
    })

    test('does nothing when the theme file does not exist on local disk', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const root = tmpDir
        await copyDirectoryContents(joinPath(locationOfThisFile, 'fixtures/theme'), root)

        // When
        const themeFileSystem = mountThemeFileSystem(root)
        await themeFileSystem.ready()
        await themeFileSystem.delete('assets/nonexistent.css')

        // Then
        expect(themeFileSystem.files.has('assets/nonexistent.css')).toBe(false)
      })
    })

    test('delete updates files map before the async removeFile call', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const fileKey = 'assets/base.css'
        const root = tmpDir
        await copyDirectoryContents(joinPath(locationOfThisFile, 'fixtures/theme'), root)
        const themeFileSystem = mountThemeFileSystem(root)
        await themeFileSystem.ready()

        let filesUpdated = false
        // We use vi.spyOn to intercept the call while still performing it.
        const removeFileSpy = vi.spyOn(fsKit, 'removeFile').mockImplementationOnce(async (path) => {
          filesUpdated = !themeFileSystem.files.has(fileKey)
          await fsKit.removeFile(path)
        })

        // When
        expect(themeFileSystem.files.has(fileKey)).toBe(true)
        await themeFileSystem.delete(fileKey)

        // Then
        expect(filesUpdated).toBe(true)
        removeFileSpy.mockRestore()
      })
    })
  })

  describe('themeFileSystem.write', () => {
    test('rejects a parent traversal key before changing files or writing outside the theme', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const root = joinPath(tmpDir, 'theme')
        await mkdir(root)
        const themeFileSystem = mountThemeFileSystem(root)
        await themeFileSystem.ready()

        const write = themeFileSystem.write({key: '../outside.txt', checksum: '1010', value: 'owned'})

        await expect(write).rejects.toThrow(AbortError)
        expect(themeFileSystem.files.size).toBe(0)
        await expect(fileExists(joinPath(tmpDir, 'outside.txt'))).resolves.toBe(false)
      })
    })

    test.each([
      '.',
      './',
      '..\\outside.txt',
      '/outside.txt',
      '\\outside.txt',
      'C:\\outside.txt',
      'assets/../../outside.txt',
      '../theme-sibling/outside.txt',
    ])('rejects unsafe key %s before changing files', async (key) => {
      await inTemporaryDirectory(async (tmpDir) => {
        const root = joinPath(tmpDir, 'theme')
        await mkdir(root)
        const themeFileSystem = mountThemeFileSystem(root)
        await themeFileSystem.ready()

        await expect(themeFileSystem.write({key, checksum: '1010', value: 'owned'})).rejects.toThrow(AbortError)

        expect(themeFileSystem.files.size).toBe(0)
        await expect(fileExists(joinPath(tmpDir, 'outside.txt'))).resolves.toBe(false)
      })
    })

    test('accepts nested keys and names beginning with two periods', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const root = joinPath(tmpDir, 'theme')
        await mkdir(root)
        const themeFileSystem = mountThemeFileSystem(root)
        await themeFileSystem.ready()

        await themeFileSystem.write({key: 'assets/nested/..notes.css', checksum: '1010', value: 'safe'})

        await expect(readFile(joinPath(root, 'assets/nested/..notes.css'))).resolves.toBe('safe')
      })
    })

    test('"write" creates a file on the local disk and updates the file map', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const root = tmpDir
        await copyDirectoryContents(joinPath(locationOfThisFile, 'fixtures/theme'), root)

        // When
        const themeFileSystem = mountThemeFileSystem(root)
        await themeFileSystem.ready()
        expect(themeFileSystem.files.get('assets/new_file.css')).toBeUndefined()

        await themeFileSystem.write({key: 'assets/new_file.css', checksum: '1010', value: 'content'})

        // Then
        await expect(readFile(joinPath(root, 'assets/new_file.css'))).resolves.toBe('content')
        expect(themeFileSystem.files.get('assets/new_file.css')).toEqual({
          key: 'assets/new_file.css',
          checksum: '1010',
          value: 'content',
          stats: {size: 7, mtime: expect.any(Number)},
          attachment: '',
        })
      })
    })

    test('"write" creates an image file on the local disk and updates the file map', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const root = tmpDir
        await copyDirectoryContents(joinPath(locationOfThisFile, 'fixtures/theme'), root)
        const attachment = '0x123!'
        const buffer = Buffer.from(attachment, 'base64')

        // When
        const themeFileSystem = mountThemeFileSystem(root)
        await themeFileSystem.ready()
        expect(themeFileSystem.files.get('assets/new_image.gif')).toBeUndefined()

        await themeFileSystem.write({key: 'assets/new_image.gif', checksum: '1010', attachment})

        // Then
        await expect(readFile(joinPath(root, 'assets/new_image.gif'), {})).resolves.toEqual(buffer)
        expect(themeFileSystem.files.get('assets/new_image.gif')).toEqual({
          key: 'assets/new_image.gif',
          checksum: '1010',
          attachment,
          value: '',
          stats: {size: 6, mtime: expect.any(Number)},
        })
      })
    })

    test('write updates files map before the async writeFile call', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const root = tmpDir
        const themeFileSystem = mountThemeFileSystem(root)
        await themeFileSystem.ready()

        const newAsset = {key: 'assets/new_file.css', checksum: '1010', value: 'content'}

        let filesUpdated = false
        const writeFileSpy = vi.spyOn(fsKit, 'writeFile').mockImplementationOnce(async (path, data, options) => {
          const file = themeFileSystem.files.get(newAsset.key)
          if (
            file?.key === newAsset.key &&
            file.checksum === newAsset.checksum &&
            file.value === newAsset.value &&
            file.stats?.size === 7
          ) {
            filesUpdated = true
          }
          await fsKit.writeFile(path, data, options)
        })

        // When
        expect(themeFileSystem.files.has(newAsset.key)).toBe(false)
        await themeFileSystem.write(newAsset)

        // Then
        expect(filesUpdated).toBe(true)
        writeFileSpy.mockRestore()
      })
    })
  })

  describe('themeFileSystem.read', async () => {
    test.skipIf(process.platform === 'win32').each(['read', 'write', 'delete', 'missing-descendant write'])(
      'rejects %s through a POSIX literal-backslash outside target without effects',
      async (operation) => {
        await inTemporaryDirectory(async (tmpDir) => {
          const root = joinPath(tmpDir, 'theme')
          // Preserve the literal backslash in the POSIX filename instead of normalizing it with joinPath.
          const outsideDir = `${joinPath(tmpDir, 'outside')}/..\\theme`
          const outsidePath = `${outsideDir}/secret.css`
          const missingPath = `${outsideDir}/nested/new.css`
          await mkdir(root)
          await mkdir(outsideDir)
          await writeFile(outsidePath, 'secret')
          const themeFileSystem = mountThemeFileSystem(root)
          await themeFileSystem.ready()
          await symlink(outsideDir, joinPath(root, 'assets'))
          const filesBefore = new Map(themeFileSystem.files)

          await expect(readFile(outsidePath)).resolves.toBe('secret')

          let result: Promise<unknown>
          if (operation === 'read') {
            result = themeFileSystem.read('assets/secret.css')
          } else if (operation === 'delete') {
            result = themeFileSystem.delete('assets/secret.css')
          } else {
            const key = operation === 'write' ? 'assets/secret.css' : 'assets/nested/new.css'
            result = themeFileSystem.write({key, checksum: '1010', value: 'owned'})
          }

          /* Soft assertions observe every outside effect before fixture cleanup. */
          await expect.soft(result).rejects.toThrow(AbortError)
          await expect.soft(readFile(outsidePath)).resolves.toBe('secret')
          await expect.soft(readFile(missingPath)).rejects.toMatchObject({code: 'ENOENT'})
          expect.soft(themeFileSystem.files).toEqual(filesBefore)
        })
      },
    )

    test('allows ordinary in-root IO and a nested write with the root as the closest existing ancestor', async () => {
      await inTemporaryDirectory(async (root) => {
        const themeFileSystem = mountThemeFileSystem(root)
        await themeFileSystem.ready()
        const key = 'assets/nested/new.css'
        await themeFileSystem.write({key, checksum: '1010', value: 'safe'})
        await expect(readFile(joinPath(root, key))).resolves.toBe('safe')
        await expect(themeFileSystem.read(key)).resolves.toBe('safe')
        expect(themeFileSystem.files.get(key)?.value).toBe('safe')
        await themeFileSystem.delete(key)
        await expect(fileExists(joinPath(root, key))).resolves.toBe(false)
        expect(themeFileSystem.files.size).toBe(0)
      })
    })

    test('rejects a traversal key before reading outside the theme', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const root = joinPath(tmpDir, 'theme')
        await mkdir(root)
        await writeFile(joinPath(tmpDir, 'outside.txt'), 'secret')
        const themeFileSystem = mountThemeFileSystem(root)
        await themeFileSystem.ready()

        await expect(readThemeFile(root, '../outside.txt')).rejects.toThrow(AbortError)
        await expect(themeFileSystem.read('../outside.txt')).rejects.toThrow(AbortError)
        expect(themeFileSystem.files.size).toBe(0)
      })
    })

    test('rejects a parent symlink outside the theme for read, write, and delete', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const root = joinPath(tmpDir, 'theme')
        const outsideDir = joinPath(tmpDir, 'outside')
        const outsidePath = joinPath(outsideDir, 'secret.css')
        await mkdir(root)
        await mkdir(outsideDir)
        await writeFile(outsidePath, 'secret')
        const themeFileSystem = mountThemeFileSystem(root)
        await themeFileSystem.ready()
        await symlink(outsideDir, joinPath(root, 'assets'))

        await expect(themeFileSystem.read('assets/secret.css')).rejects.toThrow(AbortError)
        await expect(
          themeFileSystem.write({key: 'assets/secret.css', checksum: '1010', value: 'owned'}),
        ).rejects.toThrow(AbortError)
        await expect(themeFileSystem.delete('assets/secret.css')).rejects.toThrow(AbortError)
        expect(themeFileSystem.files.size).toBe(0)
        await expect(readFile(outsidePath)).resolves.toBe('secret')
      })
    })

    test('rejects an existing leaf symlink outside the theme', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const root = joinPath(tmpDir, 'theme')
        const outsidePath = joinPath(tmpDir, 'outside.css')
        await mkdir(joinPath(root, 'assets'))
        await writeFile(outsidePath, 'secret')
        const themeFileSystem = mountThemeFileSystem(root)
        await themeFileSystem.ready()
        await symlink(outsidePath, joinPath(root, 'assets/linked.css'))

        await expect(themeFileSystem.read('assets/linked.css')).rejects.toThrow(AbortError)
        await expect(
          themeFileSystem.write({key: 'assets/linked.css', checksum: '1010', value: 'owned'}),
        ).rejects.toThrow(AbortError)
        await expect(readFile(outsidePath)).resolves.toBe('secret')
        expect(themeFileSystem.files.size).toBe(0)
      })
    })

    test('rejects a dangling leaf symlink before writing', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const root = joinPath(tmpDir, 'theme')
        const outsidePath = joinPath(tmpDir, 'missing.css')
        await mkdir(joinPath(root, 'assets'))
        const themeFileSystem = mountThemeFileSystem(root)
        await themeFileSystem.ready()
        await symlink(outsidePath, joinPath(root, 'assets/linked.css'))

        await expect(
          themeFileSystem.write({key: 'assets/linked.css', checksum: '1010', value: 'owned'}),
        ).rejects.toThrow(AbortError)
        await expect(fileExists(outsidePath)).resolves.toBe(false)
        expect(themeFileSystem.files.size).toBe(0)
      })
    })

    test('"read" returns the content from the local disk and updates the file map', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const root = tmpDir
        await copyDirectoryContents(joinPath(locationOfThisFile, 'fixtures/theme'), root)
        const key = 'templates/404.json'
        const themeFileSystem = mountThemeFileSystem(root)
        await themeFileSystem.ready()
        const file = themeFileSystem.files.get(key)
        expect(file?.key).toBe('templates/404.json')
        expect(file?.checksum).toBe('64caf742bd427adcf497bffab63df30c')
        expect(file?.attachment).toBe('')
        expect(typeof file?.value).toBe('string')
        expect(typeof file?.stats?.size).toBe('number')
        expect(typeof file?.stats?.mtime).toBe('number')

        // When
        delete file?.value
        const content = await themeFileSystem.read(key)

        // Then
        const updatedFile = themeFileSystem.files.get(key)
        expect(updatedFile?.key).toBe('templates/404.json')
        expect(updatedFile?.checksum).toBe('64caf742bd427adcf497bffab63df30c')
        expect(updatedFile?.value).toBe(content)
        expect(updatedFile?.attachment).toBe('')
        expect(updatedFile?.stats?.size).toBe(content?.length)
        expect(typeof updatedFile?.stats?.mtime).toBe('number')
      })
    })
  })

  describe('themeFileSystem discovery selection', () => {
    test.each([
      {name: 'CLI ignore', filters: {ignore: ['assets/linked.css']}, ignoreFile: ''},
      {name: 'CLI only', filters: {only: ['assets/safe.css']}, ignoreFile: ''},
      {name: 'real .shopifyignore', filters: {}, ignoreFile: 'assets/linked.css\n'},
    ])('loads only the safe asset when $name excludes an outside symlink', async ({filters, ignoreFile}) => {
      await inTemporaryDirectory(async (tmpDir) => {
        const realModule = await vi.importActual<typeof import('./asset-ignore.js')>('./asset-ignore.js')
        vi.mocked(getPatternsFromShopifyIgnore).mockImplementation(realModule.getPatternsFromShopifyIgnore)
        const root = joinPath(tmpDir, 'theme')
        const outsidePath = joinPath(tmpDir, 'outside.css')
        await mkdir(joinPath(root, 'assets'))
        await writeFile(joinPath(root, 'assets/safe.css'), 'safe')
        await writeFile(outsidePath, 'secret')
        await symlink(outsidePath, joinPath(root, 'assets/linked.css'))
        if (ignoreFile) await writeFile(joinPath(root, '.shopifyignore'), ignoreFile)

        const themeFileSystem = mountThemeFileSystem(root, {filters})
        await expect(themeFileSystem.ready()).resolves.toBeUndefined()
        expect([...themeFileSystem.files.keys()]).toEqual(['assets/safe.css'])
        expect(themeFileSystem.files.get('assets/safe.css')?.value).toBe('safe')
        const filesBefore = new Map(themeFileSystem.files)

        await expect(themeFileSystem.read('assets/linked.css')).rejects.toThrow(AbortError)
        await expect(
          themeFileSystem.write({key: 'assets/linked.css', checksum: '1010', value: 'owned'}),
        ).rejects.toThrow(AbortError)
        await expect(themeFileSystem.delete('assets/linked.css')).rejects.toThrow(AbortError)
        await expect(readFile(outsidePath)).resolves.toBe('secret')
        expect(themeFileSystem.files).toEqual(filesBefore)
      })
    })

    test('loads a healthy safe-only theme', async () => {
      await inTemporaryDirectory(async (root) => {
        await mkdir(joinPath(root, 'assets'))
        await writeFile(joinPath(root, 'assets/safe.css'), 'safe')
        const themeFileSystem = mountThemeFileSystem(root)
        await themeFileSystem.ready()
        expect([...themeFileSystem.files.keys()]).toEqual(['assets/safe.css'])
        expect(themeFileSystem.files.get('assets/safe.css')?.value).toBe('safe')
      })
    })

    test.each([
      {name: 'unfiltered', filters: {}},
      {name: 'only-selected', filters: {only: ['assets/linked.css']}},
    ])('rejects readiness for an $name outside symlink', async ({filters}) => {
      await inTemporaryDirectory(async (tmpDir) => {
        const root = joinPath(tmpDir, 'theme')
        const outsidePath = joinPath(tmpDir, 'outside.css')
        await mkdir(joinPath(root, 'assets'))
        await writeFile(joinPath(root, 'assets/safe.css'), 'safe')
        await writeFile(outsidePath, 'secret')
        await symlink(outsidePath, joinPath(root, 'assets/linked.css'))
        const themeFileSystem = mountThemeFileSystem(root, {filters})

        await expect(themeFileSystem.ready()).rejects.toThrow(AbortError)
        await expect(readFile(outsidePath)).resolves.toBe('secret')
        expect(themeFileSystem.files.has('assets/linked.css')).toBe(false)
      })
    })

    test.each([
      {source: 'CLI ignore', reincluded: 'safe'},
      {source: 'CLI ignore', reincluded: 'linked'},
      {source: 'real .shopifyignore', reincluded: 'safe'},
      {source: 'real .shopifyignore', reincluded: 'linked'},
    ])('honors $source negation reincluding $reincluded before reading', async ({source, reincluded}) => {
      await inTemporaryDirectory(async (tmpDir) => {
        const realModule = await vi.importActual<typeof import('./asset-ignore.js')>('./asset-ignore.js')
        vi.mocked(getPatternsFromShopifyIgnore).mockImplementation(realModule.getPatternsFromShopifyIgnore)
        const root = joinPath(tmpDir, 'theme')
        const outsidePath = joinPath(tmpDir, 'outside.css')
        await mkdir(joinPath(root, 'assets'))
        await writeFile(joinPath(root, 'assets/safe.css'), 'safe')
        await writeFile(outsidePath, 'secret')
        await symlink(outsidePath, joinPath(root, 'assets/linked.css'))
        const patterns = ['assets/*.css', `!assets/${reincluded}.css`]
        if (source === 'real .shopifyignore') {
          await writeFile(joinPath(root, '.shopifyignore'), `${patterns.join('\n')}\n`)
        }
        const filters = source === 'CLI ignore' ? {ignore: patterns} : {}
        const themeFileSystem = mountThemeFileSystem(root, {filters})

        if (reincluded === 'safe') {
          await expect(themeFileSystem.ready()).resolves.toBeUndefined()
          expect([...themeFileSystem.files.keys()]).toEqual(['assets/safe.css'])
          expect(themeFileSystem.files.get('assets/safe.css')?.value).toBe('safe')
        } else {
          await expect(themeFileSystem.ready()).rejects.toThrow(AbortError)
          expect(themeFileSystem.files.has('assets/linked.css')).toBe(false)
        }
        await expect(readFile(outsidePath)).resolves.toBe('secret')
      })
    })
  })

  describe('themeFileSystem.applyIgnoreFilters', async () => {
    test('applies ignore filters to the theme files', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const root = tmpDir
        const files = [{key: 'assets/file.css'}, {key: 'assets/file.json'}]
        const options = {filters: {ignore: ['assets/*.css']}}

        const themeFileSystem = mountThemeFileSystem(root, options)
        await themeFileSystem.ready()

        expect(getPatternsFromShopifyIgnore).toHaveBeenCalledWith(root)
        expect(themeFileSystem.applyIgnoreFilters(files)).toEqual([{key: 'assets/file.json'}])
        expect(applyIgnoreFilters).toHaveBeenCalledWith(files, {
          ignore: options.filters.ignore,
          only: [],
          ignoreFromFile: [],
        })
      })
    })
  })

  describe('readThemeFile', () => {
    test('reads theme file when it exists', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const root = tmpDir
        await copyDirectoryContents(joinPath(locationOfThisFile, 'fixtures/theme'), root)
        const key = 'templates/404.json'

        // When
        const content = await readThemeFile(root, key)
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        const contentJson = JSON.parse(content?.toString() || '')

        // Then
        expect(contentJson).toEqual({
          sections: {
            main: {
              type: 'main-404',
              settings: {},
            },
          },
          order: ['main'],
        })
      })
    })

    test(`returns undefined when theme file doesn't exist`, async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const root = tmpDir
        await copyDirectoryContents(joinPath(locationOfThisFile, 'fixtures/theme'), root)
        const key = 'templates/invalid.json'

        // When
        const content = await readThemeFile(root, key)

        // Then
        expect(content).toBeUndefined()
      })
    })

    test('returns Buffer for image files', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const root = tmpDir
        await copyDirectoryContents(joinPath(locationOfThisFile, 'fixtures/theme'), root)
        const key = 'assets/sparkle.gif'

        // When
        const content = await readThemeFile(root, key)

        // Then
        expect(content).toBeDefined()
        expect(Buffer.isBuffer(content)).toBe(true)
      })
    })
  })

  describe('isThemeAsset', () => {
    test(`returns true when it's a theme asset`, async () => {
      // Given
      const path = 'assets/404.json'

      // When
      const result = isThemeAsset(path)

      // Then
      expect(result).toBeTruthy()
    })

    test(`returns false when it's not a theme asset`, async () => {
      // Given
      const path = 'templates/404.json'

      // When
      const result = isThemeAsset(path)

      // Then
      expect(result).toBeFalsy()
    })
  })

  describe('isJson', () => {
    test(`returns true when it's a json file`, async () => {
      // Given
      const path = 'assets/404.json'

      // When
      const result = isJson(path)

      // Then
      expect(result).toBeTruthy()
    })

    test(`returns false when it's not a json file`, async () => {
      // Given
      const path = 'assets/image.png'

      // When
      const result = isJson(path)

      // Then
      expect(result).toBeFalsy()
    })
  })

  describe('partitionThemeFiles', () => {
    test('should partition theme files correctly', () => {
      // Given
      const files: Checksum[] = [
        {key: 'assets/base.css', checksum: '1'},
        {key: 'assets/base.css.liquid', checksum: '2'},
        {key: 'assets/sparkle.gif', checksum: '3'},
        {key: 'layout/password.liquid', checksum: '4'},
        {key: 'layout/theme.liquid', checksum: '5'},
        {key: 'layout/custom.liquid', checksum: '15'},
        {key: 'locales/en.default.json', checksum: '6'},
        {key: 'templates/404.json', checksum: '7'},
        {key: 'config/settings_schema.json', checksum: '8'},
        {key: 'config/settings_data.json', checksum: '9'},
        {key: 'config/styles.css', checksum: '16'},
        {key: 'sections/announcement-bar.liquid', checksum: '10'},
        {key: 'snippets/language-localization.liquid', checksum: '11'},
        {key: 'templates/404.context.uk.json', checksum: '12'},
        {key: 'templates/404.liquid', checksum: '13'},
        {key: 'blocks/block.liquid', checksum: '14'},
        {key: 'AGENTS.md', checksum: '17'},
        {key: 'DESIGN.md', checksum: '18'},
      ]
      // When
      const {
        sectionLiquidFiles,
        otherLiquidFiles,
        templateJsonFiles,
        otherJsonFiles,
        configSchemaFile,
        configDataFile,
        configStylesheetFiles,
        staticAssetFiles,
        contextualizedJsonFiles,
        blockLiquidFiles,
        layoutFiles,
        documentationFiles,
      } = partitionThemeFiles(files)

      // Then
      expect(sectionLiquidFiles).toEqual([{key: 'sections/announcement-bar.liquid', checksum: '10'}])
      expect(otherLiquidFiles).toEqual([
        {key: 'assets/base.css.liquid', checksum: '2'},
        {key: 'snippets/language-localization.liquid', checksum: '11'},
        {key: 'templates/404.liquid', checksum: '13'},
      ])
      expect(otherJsonFiles).toEqual([{key: 'locales/en.default.json', checksum: '6'}])
      expect(templateJsonFiles).toEqual([{key: 'templates/404.json', checksum: '7'}])
      expect(configSchemaFile).toEqual([{key: 'config/settings_schema.json', checksum: '8'}])
      expect(configDataFile).toEqual([{key: 'config/settings_data.json', checksum: '9'}])
      expect(configStylesheetFiles).toEqual([{key: 'config/styles.css', checksum: '16'}])
      expect(staticAssetFiles).toEqual([
        {key: 'assets/base.css', checksum: '1'},
        {key: 'assets/sparkle.gif', checksum: '3'},
      ])
      expect(contextualizedJsonFiles).toEqual([{key: 'templates/404.context.uk.json', checksum: '12'}])
      expect(blockLiquidFiles).toEqual([{key: 'blocks/block.liquid', checksum: '14'}])
      expect(layoutFiles).toEqual([
        {key: 'layout/password.liquid', checksum: '4'},
        {key: 'layout/theme.liquid', checksum: '5'},
        {key: 'layout/custom.liquid', checksum: '15'},
      ])
      expect(documentationFiles).toEqual([
        {key: 'AGENTS.md', checksum: '17'},
        {key: 'DESIGN.md', checksum: '18'},
      ])
    })

    test('should handle empty file array', () => {
      // Given
      const files: Checksum[] = []

      // When
      const {
        sectionLiquidFiles,
        otherLiquidFiles,
        templateJsonFiles,
        otherJsonFiles,
        configSchemaFile,
        configDataFile,
        configStylesheetFiles,
        staticAssetFiles,
        documentationFiles,
      } = partitionThemeFiles(files)

      // Then
      expect(sectionLiquidFiles).toEqual([])
      expect(otherLiquidFiles).toEqual([])
      expect(templateJsonFiles).toEqual([])
      expect(otherJsonFiles).toEqual([])
      expect(configSchemaFile).toEqual([])
      expect(configDataFile).toEqual([])
      expect(configStylesheetFiles).toEqual([])
      expect(staticAssetFiles).toEqual([])
      expect(documentationFiles).toEqual([])
    })
  })

  describe('isTextFile', () => {
    test(`returns true when it's a text file`, async () => {
      expect(isTextFile('assets/main.js')).toBeTruthy()
      expect(isTextFile('assets/style1.css')).toBeTruthy()
      expect(isTextFile('assets/style2.scss')).toBeTruthy()
      expect(isTextFile('assets/style3.sass')).toBeTruthy()
      expect(isTextFile('assets/icon.svg')).toBeTruthy()
      expect(isTextFile('sections/template.liquid')).toBeTruthy()
      expect(isTextFile('templates/cart.json')).toBeTruthy()
      expect(isTextFile('AGENTS.md')).toBeTruthy()
      expect(isTextFile('DESIGN.md')).toBeTruthy()
    })

    test(`returns false when it's not a text file`, async () => {
      expect(isTextFile('assets/font.woff')).toBeFalsy()
      expect(isTextFile('assets/image.gif')).toBeFalsy()
      expect(isTextFile('assets/image.jpeg')).toBeFalsy()
      expect(isTextFile('assets/image.jpg')).toBeFalsy()
      expect(isTextFile('assets/image.png')).toBeFalsy()
    })
  })

  describe('hasRequiredThemeDirectories', () => {
    test(`returns true when directory has all required theme directories`, async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const root = tmpDir
        await copyDirectoryContents(joinPath(locationOfThisFile, 'fixtures/theme'), root)

        // When
        const result = await hasRequiredThemeDirectories(root)

        // Then
        expect(result).toBeTruthy()
      })
    })

    test(`returns false when directory doesn't have all required theme directories`, async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const root = tmpDir

        // When
        const result = await hasRequiredThemeDirectories(root)

        // Then
        expect(result).toBeFalsy()
      })
    })

    test(`returns true for a valid theme directory`, async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const root = tmpDir
        await mkdir(joinPath(root, 'config'))
        await mkdir(joinPath(root, 'layout'))
        await mkdir(joinPath(root, 'templates'))

        // When
        const result = await hasRequiredThemeDirectories(root)

        // Then
        expect(result).toBeTruthy()
      })
    })
  })

  describe('listing functionality', () => {
    const themeId = '123'
    const adminSession = {token: 'token'} as AdminSession

    beforeEach(() => {
      const mockWatcher = new EventEmitter()
      vi.spyOn(chokidar, 'watch').mockImplementation((_) => {
        return mockWatcher as any
      })
    })

    test('rejects an unsafe listing name before constructing watcher paths', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        expect(() => mountThemeFileSystem(tmpDir, {listing: '../outside'})).toThrow(AbortError)
      })
    })

    test('rejects listing override reads and writes through a parent symlink', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const root = joinPath(tmpDir, 'theme')
        const outsideDir = joinPath(tmpDir, 'outside')
        const outsidePath = joinPath(outsideDir, 'templates/index.json')
        await mkdir(root)
        await mkdir(dirname(outsidePath))
        await writeFile(outsidePath, '{"secret":true}')
        const themeFileSystem = mountThemeFileSystem(root, {listing: 'modern'})
        await themeFileSystem.ready()
        await mkdir(joinPath(root, 'listings'))
        await symlink(outsideDir, joinPath(root, 'listings/modern'))

        await expect(themeFileSystem.read('templates/index.json')).rejects.toThrow(AbortError)
        await expect(
          themeFileSystem.write({key: 'templates/index.json', checksum: '1010', value: 'owned'}),
        ).rejects.toThrow(AbortError)
        expect(themeFileSystem.files.size).toBe(0)
        await expect(readFile(outsidePath)).resolves.toBe('{"secret":true}')
      })
    })

    test('rejects listing override writes through a dangling leaf symlink', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const root = joinPath(tmpDir, 'theme')
        const outsidePath = joinPath(tmpDir, 'missing.json')
        await mkdir(root)
        const themeFileSystem = mountThemeFileSystem(root, {listing: 'modern'})
        await themeFileSystem.ready()
        const listingPath = joinPath(root, 'listings/modern/templates/index.json')
        await mkdir(dirname(listingPath))
        await symlink(outsidePath, listingPath)

        await expect(
          themeFileSystem.write({key: 'templates/index.json', checksum: '1010', value: 'owned'}),
        ).rejects.toThrow(AbortError)
        expect(themeFileSystem.files.size).toBe(0)
        await expect(fileExists(outsidePath)).resolves.toBe(false)
      })
    })

    test('handles listing file changes as base theme file changes', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const root = tmpDir
        await copyDirectoryContents(joinPath(locationOfThisFile, 'fixtures/theme'), root)
        const themeFileSystem = mountThemeFileSystem(root, {listing: 'modern'})
        await themeFileSystem.ready()

        const changeEventPromise = new Promise<void>((resolve) => {
          themeFileSystem.addEventListener('change', (event) => {
            if (event.fileKey === 'templates/index.json') {
              setImmediate(resolve)
            }
          })
        })

        await themeFileSystem.startWatcher(themeId, adminSession)

        // When
        const listingFilePath = joinPath(root, 'listings', 'modern', 'templates', 'index.json')
        const watcher = chokidar.watch('') as EventEmitter
        watcher.emit('change', listingFilePath)

        // Then
        await changeEventPromise
      })
    })

    test('writes template JSON into base when listing file does not exist', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const root = tmpDir
        await copyDirectoryContents(joinPath(locationOfThisFile, 'fixtures/theme'), root)
        const themeFileSystem = mountThemeFileSystem(root, {listing: 'modern'})
        await themeFileSystem.ready()
        const asset = {key: 'templates/index.json', checksum: 'abcd', value: '{"sections":{}}'}

        // When
        await themeFileSystem.write(asset)

        // Then: with Smart behavior, if overlay file does NOT exist yet, write to base
        await expect(readFile(joinPath(root, 'templates/index.json'))).resolves.toBe(asset.value)
      })
    })

    test('writes template JSON into listing folder when listing file already exists', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const root = tmpDir
        await copyDirectoryContents(joinPath(locationOfThisFile, 'fixtures/theme'), root)
        const themeFileSystem = mountThemeFileSystem(root, {listing: 'modern'})
        await themeFileSystem.ready()
        const asset = {key: 'templates/index.json', checksum: 'abcd', value: '{"sections":{}}'}

        // Simulate existing overlay file by creating it
        const listingAbsolutePath = joinPath(root, 'listings/modern/templates/index.json')
        await mkdir(dirname(listingAbsolutePath))
        await writeFile(listingAbsolutePath, '{}')

        // When
        await themeFileSystem.write(asset)

        // Then: writes to overlay
        await expect(readFile(listingAbsolutePath)).resolves.toBe(asset.value)
      })
    })

    test('writes section JSON into listing folder when listing is active', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const root = tmpDir
        await copyDirectoryContents(joinPath(locationOfThisFile, 'fixtures/theme'), root)
        const themeFileSystem = mountThemeFileSystem(root, {listing: 'modern'})
        await themeFileSystem.ready()
        const asset = {key: 'sections/header.json', checksum: 'abc1', value: '{"name":"Header"}'}

        // When
        await themeFileSystem.write(asset)

        // Then: Smart behavior writes to base if overlay does not exist
        await expect(readFile(joinPath(root, 'sections/header.json'))).resolves.toBe(asset.value)
      })
    })

    test('writes section JSON into listing folder when listing file already exists', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const root = tmpDir
        await copyDirectoryContents(joinPath(locationOfThisFile, 'fixtures/theme'), root)
        const themeFileSystem = mountThemeFileSystem(root, {listing: 'modern'})
        await themeFileSystem.ready()
        const asset = {key: 'sections/header.json', checksum: 'abc1', value: '{"name":"Header"}'}

        // Simulate existing overlay file by creating it
        const listingAbsolutePath = joinPath(root, 'listings/modern/sections/header.json')
        await mkdir(dirname(listingAbsolutePath))
        await writeFile(listingAbsolutePath, '{}')

        // When
        await themeFileSystem.write(asset)

        // Then: writes to overlay
        await expect(readFile(listingAbsolutePath)).resolves.toBe(asset.value)
      })
    })

    test('writes non-JSON files to base when listing is active', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const root = tmpDir
        await copyDirectoryContents(joinPath(locationOfThisFile, 'fixtures/theme'), root)
        const themeFileSystem = mountThemeFileSystem(root, {listing: 'modern'})
        await themeFileSystem.ready()
        const asset = {
          key: 'sections/announcement-bar.liquid',
          checksum: 'abc2',
          value: '{% comment %}x{% endcomment %}',
        }

        // When
        await themeFileSystem.write(asset as any)

        // Then
        await expect(readFile(joinPath(root, 'sections/announcement-bar.liquid'))).resolves.toBe(asset.value)
      })
    })

    test('writes template JSON to base when no listing is specified', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const root = tmpDir
        await copyDirectoryContents(joinPath(locationOfThisFile, 'fixtures/theme'), root)
        const themeFileSystem = mountThemeFileSystem(root)
        await themeFileSystem.ready()
        const asset = {key: 'templates/index.json', checksum: 'ef01', value: '{"sections":{}}'}

        // When
        await themeFileSystem.write(asset)

        // Then
        await expect(readFile(joinPath(root, 'templates/index.json'))).resolves.toBe(asset.value)
      })
    })
  })

  describe('handleFileDelete', () => {
    const themeId = '1'
    const adminSession = {token: 'token', storeFqdn: 'store.myshopify.com'}

    beforeEach(() => {
      const mockWatcher = new EventEmitter()
      vi.spyOn(chokidar, 'watch').mockImplementation((_) => {
        return mockWatcher as any
      })
    })

    test('deletes file from remote theme', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const root = tmpDir
        await copyDirectoryContents(joinPath(locationOfThisFile, 'fixtures/theme'), root)
        vi.mocked(fetchThemeAssets).mockResolvedValue([
          {
            key: 'assets/base.css',
            checksum: '1',
            value: 'content',
            attachment: '',
            stats: {size: 100, mtime: 100},
          },
        ])
        vi.mocked(deleteThemeAssets).mockResolvedValue([
          {key: 'assets/base.css', success: true, operation: Operation.Delete},
        ])

        // When
        const themeFileSystem = mountThemeFileSystem(root)
        await themeFileSystem.ready()

        const deleteOperationPromise = new Promise<void>((resolve) => {
          themeFileSystem.addEventListener('unlink', () => {
            setImmediate(resolve)
          })
        })

        await themeFileSystem.startWatcher(themeId, adminSession)

        // Explicitly emit the 'unlink' event
        const watcher = chokidar.watch('') as EventEmitter
        watcher.emit('unlink', `${root}/assets/base.css`)

        await deleteOperationPromise

        // Then
        expect(deleteThemeAssets).toHaveBeenCalledWith(Number(themeId), ['assets/base.css'], adminSession)
      })
    })

    test('clears any entries in uploadErrors when a file is deleted', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const root = tmpDir
        await copyDirectoryContents(joinPath(locationOfThisFile, 'fixtures/theme'), root)
        const fileKey = 'assets/base.css'
        vi.mocked(fetchThemeAssets).mockResolvedValue([
          {
            key: fileKey,
            checksum: '1',
            value: 'content',
            attachment: '',
            stats: {size: 100, mtime: 100},
          },
        ])
        vi.mocked(deleteThemeAssets).mockResolvedValue([{key: fileKey, success: true, operation: Operation.Delete}])

        // When
        const themeFileSystem = mountThemeFileSystem(root)
        await themeFileSystem.ready()

        // Add an error to the uploadErrors map
        themeFileSystem.uploadErrors.set(fileKey, ['Some upload error'])
        expect(themeFileSystem.uploadErrors.has(fileKey)).toBe(true)

        const deleteOperationPromise = new Promise<void>((resolve) => {
          themeFileSystem.addEventListener('unlink', () => {
            setImmediate(resolve)
          })
        })

        await themeFileSystem.startWatcher(themeId, adminSession)

        // Explicitly emit the 'unlink' event
        const watcher = chokidar.watch('') as EventEmitter
        watcher.emit('unlink', `${root}/${fileKey}`)

        await deleteOperationPromise

        // Then
        expect(themeFileSystem.uploadErrors.has(fileKey)).toBe(false)
        expect(deleteThemeAssets).toHaveBeenCalledWith(Number(themeId), [fileKey], adminSession)
      })
    })

    test('does not delete file from remote when options.noDelete is true', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const root = tmpDir
        await copyDirectoryContents(joinPath(locationOfThisFile, 'fixtures/theme'), root)
        vi.mocked(fetchThemeAssets).mockResolvedValue([
          {
            key: 'assets/base.css',
            checksum: '1',
            value: 'content',
            attachment: '',
            stats: {size: 100, mtime: 100},
          },
        ])
        vi.mocked(deleteThemeAssets).mockResolvedValue([
          {key: 'assets/base.css', success: true, operation: Operation.Delete},
        ])

        // When
        const themeFileSystem = mountThemeFileSystem(root, {noDelete: true})
        await themeFileSystem.ready()

        const deleteOperationPromise = new Promise<void>((resolve) => {
          themeFileSystem.addEventListener('unlink', () => {
            setImmediate(resolve)
          })
        })

        await themeFileSystem.startWatcher(themeId, adminSession)

        // Explicitly emit the 'unlink' event
        const watcher = chokidar.watch('') as EventEmitter
        watcher.emit('unlink', `${root}/assets/base.css`)

        await deleteOperationPromise

        // Then
        expect(deleteThemeAssets).not.toHaveBeenCalled()
      })
    })

    test('renders a warning to debug if the file deletion fails', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const root = tmpDir
        await copyDirectoryContents(joinPath(locationOfThisFile, 'fixtures/theme'), root)
        vi.mocked(fetchThemeAssets).mockResolvedValue([
          {
            key: 'assets/base.css',
            value: 'file content',
            checksum: '1',
            stats: {size: 100, mtime: 100},
          },
        ])
        vi.mocked(deleteThemeAssets).mockResolvedValue([
          {key: 'assets/base.css', success: false, operation: Operation.Delete},
        ])

        // When
        const themeFileSystem = mountThemeFileSystem(root)
        await themeFileSystem.ready()

        const deleteOperationPromise = new Promise<void>((resolve) => {
          themeFileSystem.addEventListener('unlink', () => {
            setImmediate(resolve)
          })
        })

        await themeFileSystem.startWatcher(themeId, adminSession)

        // Explicitly emit the 'unlink' event
        const watcher = chokidar.watch('') as EventEmitter
        watcher.emit('unlink', `${root}/assets/base.css`)

        await deleteOperationPromise

        // Then
        expect(deleteThemeAssets).toHaveBeenCalledWith(Number(themeId), ['assets/base.css'], adminSession)
        expect(renderError).toHaveBeenCalledWith({
          headline: 'Failed to delete file "assets/base.css" from remote theme.',
          body: expect.any(String),
        })
      })
    })
  })

  describe('watcher error handling', () => {
    const themeId = '123'
    const adminSession = {token: 'token'} as AdminSession

    beforeEach(() => {
      const mockWatcher = new EventEmitter()
      vi.spyOn(chokidar, 'watch').mockImplementation((_) => {
        return mockWatcher as any
      })
    })

    test('outputs a warning when the watcher emits an error', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const root = tmpDir
        await copyDirectoryContents(joinPath(locationOfThisFile, 'fixtures/theme'), root)
        const {outputWarn} = await import('@shopify/cli-kit/node/output')
        const themeFileSystem = mountThemeFileSystem(root)
        await themeFileSystem.ready()
        await themeFileSystem.startWatcher(themeId, adminSession)

        // When
        const watcher = chokidar.watch('') as EventEmitter
        watcher.emit('error', new Error('EMFILE: too many open files'))

        // Then
        expect(outputWarn).toHaveBeenCalledWith('File watcher error: Error: EMFILE: too many open files')
        expect(recordError).toHaveBeenCalledWith('theme-service:file-watcher:error')
      })
    })
  })

  describe('handleSyncUpdate', () => {
    const fileKey = 'assets/test.css'
    const themeId = '123'
    const adminSession = {token: 'token'} as AdminSession
    let unsyncedFileKeys: Set<string>
    let uploadErrors: Map<string, string[]>

    beforeEach(() => {
      unsyncedFileKeys = new Set([fileKey])
      uploadErrors = new Map()
      vi.mocked(triggerBrowserFullReload).mockClear()
    })

    test('returns false if file is not in unsyncedFileKeys', async () => {
      // Given
      unsyncedFileKeys = new Set()
      const handler = handleSyncUpdate(unsyncedFileKeys, uploadErrors, fileKey, themeId, adminSession)

      // When
      const result = await handler({value: 'content'})

      // Then
      expect(result).toBe(false)
      expect(bulkUploadThemeAssets).not.toHaveBeenCalled()
      expect(triggerBrowserFullReload).not.toHaveBeenCalled()
    })

    Object.entries({
      text: {value: 'content'},
      image: {attachment: 'content'},
    }).forEach(([fileType, fileContent]) => {
      test(`uploads ${fileType} file and returns true on successful sync`, async () => {
        // Given
        vi.mocked(bulkUploadThemeAssets).mockResolvedValue([
          {
            key: fileKey,
            success: true,
            operation: Operation.Upload,
          },
        ])
        const handler = handleSyncUpdate(unsyncedFileKeys, uploadErrors, fileKey, themeId, adminSession)

        // When
        const result = await handler(fileContent)

        // Then
        expect(result).toBe(true)
        expect(bulkUploadThemeAssets).toHaveBeenCalledWith(
          Number(themeId),
          [{key: fileKey, ...fileContent}],
          adminSession,
        )
        expect(unsyncedFileKeys.has(fileKey)).toBe(false)
        expect(triggerBrowserFullReload).not.toHaveBeenCalled()
      })
    })

    test('throws error and sets uploadErrors on failed sync', async () => {
      // Given
      const errors = ['{{ broken liquid file']
      vi.mocked(bulkUploadThemeAssets).mockResolvedValue([
        {
          key: fileKey,
          success: false,
          operation: Operation.Upload,
          errors: {asset: errors},
        },
      ])
      const handler = handleSyncUpdate(unsyncedFileKeys, uploadErrors, fileKey, themeId, adminSession)

      // When/Then
      await expect(handler({value: 'content'})).rejects.toThrow('{{ broken liquid file')
      expect(uploadErrors.get(fileKey)).toEqual(errors)
      expect(unsyncedFileKeys.has(fileKey)).toBe(true)
      expect(triggerBrowserFullReload).toHaveBeenCalledWith(themeId, fileKey)
    })

    test('clears uploadErrors if sync succeeds after previous failure', async () => {
      // Given
      uploadErrors.set(fileKey, ['Previous error'])
      vi.mocked(bulkUploadThemeAssets).mockResolvedValue([
        {
          key: fileKey,
          success: true,
          operation: Operation.Upload,
        },
      ])
      const handler = handleSyncUpdate(unsyncedFileKeys, uploadErrors, fileKey, themeId, adminSession)

      // When
      await handler({value: 'content'})

      // Then
      expect(uploadErrors.has(fileKey)).toBe(false)
      expect(triggerBrowserFullReload).toHaveBeenCalledWith(themeId, fileKey)
    })
  })

  function fsEntry({key, checksum}: Checksum): [string, ThemeAsset] {
    return [
      key,
      {
        key,
        checksum,
        value: 'test-value',
        attachment: 'test-attachment',
        stats: {size: 100, mtime: 1000},
      },
    ]
  }
})
