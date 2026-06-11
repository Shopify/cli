import {mountThemeExtensionFileSystem} from './theme-ext-fs.js'
import * as themeFsModule from '../theme-fs.js'
import * as checksumModule from '../asset-checksum.js'
import {test, describe, expect, vi, beforeEach, afterEach} from 'vitest'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import * as systemModule from '@shopify/cli-kit/node/system'
import chokidar from 'chokidar'
import EventEmitter from 'node:events'
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

  describe('startWatcher debounce', () => {
    const root = joinPath(locationOfThisFile, '../fixtures/theme-ext')

    beforeEach(() => {
      vi.useFakeTimers()
      const mockWatcher = new EventEmitter()
      vi.spyOn(chokidar, 'watch').mockImplementation((_) => {
        return mockWatcher as any
      })
      vi.spyOn(themeFsModule, 'readThemeFile').mockResolvedValue('mock content')
      vi.spyOn(checksumModule, 'calculateChecksum').mockReturnValue('mock-checksum')
      vi.spyOn(systemModule, 'sleep').mockResolvedValue(undefined as any)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    test('triggers handler after debounce period (add event)', async () => {
      const themeFileSystem = mountThemeExtensionFileSystem(root)
      await themeFileSystem.ready()

      const addHandler = vi.fn()
      themeFileSystem.addEventListener('add', addHandler)

      await themeFileSystem.startWatcher()

      const watcher = chokidar.watch('') as unknown as EventEmitter
      watcher.emit('add', joinPath(root, 'blocks/new_block.liquid'))

      expect(addHandler).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(250)

      expect(addHandler).toHaveBeenCalledOnce()
      expect(addHandler).toHaveBeenCalledWith(expect.objectContaining({fileKey: 'blocks/new_block.liquid'}))
    })

    test('triggers delete handler after debounce period (unlink event)', async () => {
      const themeFileSystem = mountThemeExtensionFileSystem(root)
      await themeFileSystem.ready()

      const unlinkHandler = vi.fn()
      themeFileSystem.addEventListener('unlink', unlinkHandler)

      await themeFileSystem.startWatcher()

      const watcher = chokidar.watch('') as unknown as EventEmitter
      watcher.emit('unlink', joinPath(root, 'blocks/star_rating.liquid'))

      expect(unlinkHandler).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(250)

      expect(unlinkHandler).toHaveBeenCalledOnce()
      expect(unlinkHandler).toHaveBeenCalledWith(expect.objectContaining({fileKey: 'blocks/star_rating.liquid'}))
      expect(themeFileSystem.files.has('blocks/star_rating.liquid')).toBe(false)
    })

    test('collapses rapid duplicate events into single handler call', async () => {
      const themeFileSystem = mountThemeExtensionFileSystem(root)
      await themeFileSystem.ready()

      const changeHandler = vi.fn()
      themeFileSystem.addEventListener('change', changeHandler)

      await themeFileSystem.startWatcher()

      const watcher = chokidar.watch('') as unknown as EventEmitter
      const filePath = joinPath(root, 'blocks/star_rating.liquid')

      watcher.emit('change', filePath)
      watcher.emit('change', filePath)
      watcher.emit('change', filePath)
      watcher.emit('change', filePath)
      watcher.emit('change', filePath)

      await vi.advanceTimersByTimeAsync(250)

      expect(changeHandler).toHaveBeenCalledOnce()
    })

    test('debounces different files independently', async () => {
      const themeFileSystem = mountThemeExtensionFileSystem(root)
      await themeFileSystem.ready()

      const changeHandler = vi.fn()
      themeFileSystem.addEventListener('change', changeHandler)

      await themeFileSystem.startWatcher()

      const watcher = chokidar.watch('') as unknown as EventEmitter
      watcher.emit('change', joinPath(root, 'blocks/star_rating.liquid'))
      watcher.emit('change', joinPath(root, 'snippets/stars.liquid'))

      await vi.advanceTimersByTimeAsync(250)

      expect(changeHandler).toHaveBeenCalledTimes(2)
    })

    test('calls correct handler per event type', async () => {
      const themeFileSystem = mountThemeExtensionFileSystem(root)
      await themeFileSystem.ready()

      const addHandler = vi.fn()
      const unlinkHandler = vi.fn()
      themeFileSystem.addEventListener('add', addHandler)
      themeFileSystem.addEventListener('unlink', unlinkHandler)

      await themeFileSystem.startWatcher()

      const watcher = chokidar.watch('') as unknown as EventEmitter
      watcher.emit('add', joinPath(root, 'blocks/new_block.liquid'))
      watcher.emit('unlink', joinPath(root, 'snippets/stars.liquid'))

      await vi.advanceTimersByTimeAsync(250)

      expect(addHandler).toHaveBeenCalledOnce()
      expect(addHandler).toHaveBeenCalledWith(expect.objectContaining({fileKey: 'blocks/new_block.liquid'}))
      expect(unlinkHandler).toHaveBeenCalledOnce()
      expect(unlinkHandler).toHaveBeenCalledWith(expect.objectContaining({fileKey: 'snippets/stars.liquid'}))
    })

    test('resets debounce timer on new event for same file', async () => {
      const themeFileSystem = mountThemeExtensionFileSystem(root)
      await themeFileSystem.ready()

      const changeHandler = vi.fn()
      themeFileSystem.addEventListener('change', changeHandler)

      await themeFileSystem.startWatcher()

      const watcher = chokidar.watch('') as unknown as EventEmitter
      const filePath = joinPath(root, 'blocks/star_rating.liquid')

      watcher.emit('change', filePath)

      await vi.advanceTimersByTimeAsync(200)
      expect(changeHandler).not.toHaveBeenCalled()

      watcher.emit('change', filePath)

      await vi.advanceTimersByTimeAsync(200)
      expect(changeHandler).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(50)
      expect(changeHandler).toHaveBeenCalledOnce()
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
