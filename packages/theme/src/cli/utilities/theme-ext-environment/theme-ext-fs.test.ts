import {mountThemeExtensionFileSystem} from './theme-ext-fs.js'
import {test, describe, expect} from 'vitest'
import type {Checksum, ThemeAsset} from '@shopify/cli-kit/node/themes/types'

describe('theme-ext-fs', () => {
  describe('mountThemeExtensionFileSystem', async () => {
    test('mounts the local theme file system when the directory is valid', async () => {
      // Given
      const root = 'src/cli/utilities/fixtures/theme-ext'

      // When
      const themeFileSystem = mountThemeExtensionFileSystem(root)
      await themeFileSystem.ready()

      // Then
      expect(themeFileSystem).toEqual({
        root,
        files: new Map([
          fsEntry({checksum: 'd8ceb73ce5faa4ac22713071d2f0a6bd', key: 'blocks/star_rating.liquid'}),
          fsEntry({checksum: '02054e661bbc326a68bf7be83427d7ed', key: 'locales/en.default.json'}),
          fsEntry({checksum: '8a1dd937b2cfe9e669b26e41dc1de5e8', key: 'assets/thumbs-up.png'}),
          fsEntry({checksum: '28fa42561b59f04fc32e98feb3b994ac', key: 'snippets/stars.liquid'}),
        ]),
        unsyncedFileKeys: new Set(),
        ready: expect.any(Function),
        delete: expect.any(Function),
        write: expect.any(Function),
        read: expect.any(Function),
        addEventListener: expect.any(Function),
        startWatcher: expect.any(Function),
      })
    })

    test('mounts an empty file system when the directory is invalid', async () => {
      // Given
      const root = 'src/cli/utilities/invalid-directory'

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
      const root = 'src/cli/utilities/fixtures/theme-ext'
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
      const root = 'src/cli/utilities/fixtures/theme-ext'

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
      const root = 'src/cli/utilities/fixtures/theme-ext'
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
      const root = 'src/cli/utilities/fixtures/theme-ext'
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
      const root = 'src/cli/utilities/fixtures/theme-ext'
      const key = 'snippets/stars.liquid'
      const themeFileSystem = mountThemeExtensionFileSystem(root)
      await themeFileSystem.ready()
      const file = themeFileSystem.files.get(key)

      expect(file).toEqual({
        key: 'snippets/stars.liquid',
        checksum: '28fa42561b59f04fc32e98feb3b994ac',
        value: expect.any(String),
        attachment: '',
        stats: {size: expect.any(Number), mtime: expect.any(Number)},
      })

      // When
      delete file?.value
      const content = await themeFileSystem.read(key)

      // Then
      expect(themeFileSystem.files.get(key)).toEqual({
        key: 'snippets/stars.liquid',
        checksum: '28fa42561b59f04fc32e98feb3b994ac',
        value: content,
        attachment: '',
        stats: {size: expect.any(Number), mtime: expect.any(Number)},
      })
    })
  })

  function fsEntry({key, checksum}: Checksum): [string, ThemeAsset] {
    return [
      key,
      {
        key,
        checksum,
        value: expect.any(String),
        attachment: expect.any(String),
        stats: {size: expect.any(Number), mtime: expect.any(Number)},
      },
    ]
  }
})
