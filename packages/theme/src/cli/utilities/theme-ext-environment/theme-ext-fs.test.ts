import {mountThemeExtensionFileSystem} from './theme-ext-fs.js'
import {test, describe, expect} from 'vitest'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {fileURLToPath} from 'node:url'
import type {Checksum, ThemeAsset} from '@shopify/cli-kit/node/themes/types'

describe('theme-ext-fs', () => {
  const locationOfThisFile = dirname(fileURLToPath(import.meta.url))

  describe('mountThemeExtensionFileSystem', async () => {
    test('mounts the local theme file system when the directory is valid', async () => {
      // Given
      const root = joinPath(locationOfThisFile, '../fixtures/theme-ext')

      // When
      const themeFileSystem = mountThemeExtensionFileSystem(root)
      await themeFileSystem.ready()

      // Then
      expect(themeFileSystem.root).toBe(root)
      expect(themeFileSystem.files.size).toBe(4)
      expect(themeFileSystem.unsyncedFileKeys).toEqual(new Set())

      // Check that all expected files are present with correct checksums
      const expectedFiles = [
        {checksum: 'd8ceb73ce5faa4ac22713071d2f0a6bd', key: 'blocks/star_rating.liquid'},
        {checksum: '02054e661bbc326a68bf7be83427d7ed', key: 'locales/en.default.json'},
        {checksum: '8a1dd937b2cfe9e669b26e41dc1de5e8', key: 'assets/thumbs-up.png'},
        {checksum: '28fa42561b59f04fc32e98feb3b994ac', key: 'snippets/stars.liquid'},
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
      expect(typeof themeFileSystem.addEventListener).toBe('function')
      expect(typeof themeFileSystem.startWatcher).toBe('function')
    })

    test('mounts an empty file system when the directory is invalid', async () => {
      // Given
      const root = joinPath(locationOfThisFile, 'invalid-directory')

      // When
      const themeFileSystem = mountThemeExtensionFileSystem(root)
      await themeFileSystem.ready()

      // Then
      expect(themeFileSystem).toEqual({
        root,
        files: new Map(),
        unsyncedFileKeys: new Set(),
        ready: expect.any(Function),
        delete: expect.any(Function),
        write: expect.any(Function),
        read: expect.any(Function),
        addEventListener: expect.any(Function),
        startWatcher: expect.any(Function),
      })
    })
  })

  describe('delete', () => {
    test('"delete" removes the file from the file map', async () => {
      // Given
      const root = joinPath(locationOfThisFile, '../fixtures/theme-ext')
      const themeFileSystem = mountThemeExtensionFileSystem(root)
      await themeFileSystem.ready()

      // When
      expect(themeFileSystem.files.has('snippets/stars.liquid')).toBe(true)
      await themeFileSystem.delete('snippets/stars.liquid')

      // Then
      expect(themeFileSystem.files.has('snippets/stars.liquid')).toBe(false)
    })

    test('does nothing when the theme file does not exist', async () => {
      // Given
      const root = joinPath(locationOfThisFile, '../fixtures/theme-ext')

      // When
      const themeFileSystem = mountThemeExtensionFileSystem(root)
      await themeFileSystem.ready()
      await themeFileSystem.delete('assets/nonexistent.css')

      // Then
      expect(themeFileSystem.files.has('assets/nonexistent.css')).toBe(false)
    })
  })

  describe('write', () => {
    test('"write" creates a file on the file map', async () => {
      // Given
      const root = joinPath(locationOfThisFile, '../fixtures/theme-ext')
      const themeFileSystem = mountThemeExtensionFileSystem(root)
      await themeFileSystem.ready()

      // When
      expect(themeFileSystem.files.get('assets/new_file.css')).toBeUndefined()
      await themeFileSystem.write({key: 'assets/new_file.css', checksum: '1010', value: 'content'})

      // Then
      expect(themeFileSystem.files.get('assets/new_file.css')).toEqual({
        key: 'assets/new_file.css',
        checksum: '1010',
        value: 'content',
      })
    })

    test('"write" creates an image file on the file map', async () => {
      // Given
      const root = joinPath(locationOfThisFile, '../fixtures/theme-ext')
      const attachment = '0x123!'
      const themeFileSystem = mountThemeExtensionFileSystem(root)
      await themeFileSystem.ready()

      // When
      expect(themeFileSystem.files.get('assets/new_image.gif')).toBeUndefined()

      await themeFileSystem.write({key: 'assets/new_image.gif', checksum: '1010', attachment})

      // Then
      expect(themeFileSystem.files.get('assets/new_image.gif')).toEqual({
        key: 'assets/new_image.gif',
        checksum: '1010',
        attachment,
      })
    })
  })

  describe('read', async () => {
    test('"read" returns returns the content from the local disk and updates the file map', async () => {
      // Given
      const root = joinPath(locationOfThisFile, '../fixtures/theme-ext')
      const key = 'snippets/stars.liquid'
      const themeFileSystem = mountThemeExtensionFileSystem(root)
      await themeFileSystem.ready()
      const file = themeFileSystem.files.get(key)

      expect(file?.key).toBe('snippets/stars.liquid')
      expect(file?.checksum).toBe('28fa42561b59f04fc32e98feb3b994ac')
      expect(file?.attachment).toBe('')
      expect(typeof file?.value).toBe('string')
      expect(typeof file?.stats?.size).toBe('number')
      expect(typeof file?.stats?.mtime).toBe('number')

      // When
      delete file?.value
      const content = await themeFileSystem.read(key)

      // Then
      const updatedFile = themeFileSystem.files.get(key)
      expect(updatedFile?.key).toBe('snippets/stars.liquid')
      expect(updatedFile?.checksum).toBe('28fa42561b59f04fc32e98feb3b994ac')
      expect(updatedFile?.value).toBe(content)
      expect(updatedFile?.attachment).toBe('')
      expect(typeof updatedFile?.stats?.size).toBe('number')
      expect(typeof updatedFile?.stats?.mtime).toBe('number')
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
