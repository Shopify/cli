import {
  hasRequiredThemeDirectories,
  isJson,
  isTextFile,
  isThemeAsset,
  mountThemeFileSystem,
  partitionThemeFiles,
  readThemeFile,
} from './theme-fs.js'
import {getPatternsFromShopifyIgnore, applyIgnoreFilters} from './asset-ignore.js'
import {removeFile, writeFile} from '@shopify/cli-kit/node/fs'
import {test, describe, expect, vi, beforeEach} from 'vitest'
import chokidar from 'chokidar'
import {deleteThemeAsset, fetchThemeAssets} from '@shopify/cli-kit/node/themes/api'
import {renderError} from '@shopify/cli-kit/node/ui'
import EventEmitter from 'events'
import type {Checksum, ThemeAsset} from '@shopify/cli-kit/node/themes/types'

vi.mock('@shopify/cli-kit/node/fs', async (realImport) => {
  const realModule = await realImport<typeof import('@shopify/cli-kit/node/fs')>()
  const mockModule = {removeFile: vi.fn(), writeFile: vi.fn()}

  return {...realModule, ...mockModule}
})
vi.mock('./asset-ignore.js')
vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/output')

beforeEach(async () => {
  vi.mocked(getPatternsFromShopifyIgnore).mockResolvedValue([])
  const realModule = await vi.importActual<typeof import('./asset-ignore.js')>('./asset-ignore.js')
  vi.mocked(applyIgnoreFilters).mockImplementation(realModule.applyIgnoreFilters)
})

describe('theme-fs', () => {
  describe('mountThemeFileSystem', async () => {
    test('mounts the local theme file system when the directory is valid', async () => {
      // Given
      const root = 'src/cli/utilities/fixtures/theme'

      // When
      const themeFileSystem = mountThemeFileSystem(root)
      await themeFileSystem.ready()

      // Then
      expect(themeFileSystem).toEqual({
        root,
        files: new Map([
          fsEntry({checksum: 'b7fbe0ecff2a6c1d6e697a13096e2b17', key: 'assets/base.css'}),
          fsEntry({checksum: '7adcd48a3cc215a81fabd9dafb919507', key: 'assets/sparkle.gif'}),
          fsEntry({checksum: '22e69af13b7953914563c60035a831bc', key: 'config/settings_data.json'}),
          fsEntry({checksum: 'cbe979d3fd3b7cdf2041ada9fdb3af57', key: 'config/settings_schema.json'}),
          fsEntry({checksum: '7a92d18f1f58b2396c46f98f9e502c6a', key: 'layout/password.liquid'}),
          fsEntry({checksum: '2374357fdadd3b4636405e80e21e87fc', key: 'layout/theme.liquid'}),
          fsEntry({checksum: '0b2f0aa705a4eb2b4740e2ed68bc043f', key: 'locales/en.default.json'}),
          fsEntry({checksum: '3e8fecc3fb5e886f082e12357beb5d56', key: 'sections/announcement-bar.liquid'}),
          fsEntry({checksum: 'aa0c697b712b22753f73c84ba8a2e35a', key: 'snippets/language-localization.liquid'}),
          fsEntry({checksum: '64caf742bd427adcf497bffab63df30c', key: 'templates/404.json'}),
        ]),
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

    test('mounts an empty file system when the directory is invalid', async () => {
      // Given
      const root = 'src/cli/utilities/invalid-directory'

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

    test('"delete" removes the file from the local disk and updates the file map', async () => {
      // Given
      const root = 'src/cli/utilities/fixtures/theme'

      // When
      const themeFileSystem = mountThemeFileSystem(root)
      await themeFileSystem.ready()
      await themeFileSystem.delete('assets/base.css')

      // Then
      expect(removeFile).toBeCalledWith(`${root}/assets/base.css`)
      expect(themeFileSystem.files.has('assets/base.css')).toBe(false)
    })
  })

  describe('themeFileSystem.delete', () => {
    test('"delete" removes the file from the local disk and updates the file map', async () => {
      // Given
      const root = 'src/cli/utilities/fixtures/theme'

      // When
      const themeFileSystem = mountThemeFileSystem(root)
      await themeFileSystem.ready()
      expect(themeFileSystem.files.has('assets/base.css')).toBe(true)
      await themeFileSystem.delete('assets/base.css')

      // Then
      expect(removeFile).toBeCalledWith(`${root}/assets/base.css`)
      expect(themeFileSystem.files.has('assets/base.css')).toBe(false)
    })

    test('does nothing when the theme file does not exist on local disk', async () => {
      // Given
      const root = 'src/cli/utilities/fixtures/theme'

      // When
      const themeFileSystem = mountThemeFileSystem(root)
      await themeFileSystem.ready()
      await themeFileSystem.delete('assets/nonexistent.css')

      // Then
      expect(removeFile).not.toBeCalled()
      expect(themeFileSystem.files.has('assets/nonexistent.css')).toBe(false)
    })

    test('delete updates files map before the async removeFile call', async () => {
      // Given
      const fileKey = 'assets/base.css'
      const root = 'src/cli/utilities/fixtures/theme'
      const themeFileSystem = mountThemeFileSystem(root)
      await themeFileSystem.ready()

      let filesUpdated = false
      vi.mocked(removeFile).mockImplementationOnce(() => {
        filesUpdated = !themeFileSystem.files.has(fileKey)
        return Promise.resolve()
      })

      // When
      expect(themeFileSystem.files.has(fileKey)).toBe(true)
      await themeFileSystem.delete(fileKey)

      // Then
      expect(filesUpdated).toBe(true)
    })
  })

  describe('themeFileSystem.write', () => {
    test('"write" creates a file on the local disk and updates the file map', async () => {
      // Given
      const root = 'src/cli/utilities/fixtures/theme'

      // When
      const themeFileSystem = mountThemeFileSystem(root)
      await themeFileSystem.ready()
      expect(themeFileSystem.files.get('assets/new_file.css')).toBeUndefined()

      await themeFileSystem.write({key: 'assets/new_file.css', checksum: '1010', value: 'content'})

      // Then
      expect(writeFile).toBeCalledWith(`${root}/assets/new_file.css`, 'content')
      expect(themeFileSystem.files.get('assets/new_file.css')).toEqual({
        key: 'assets/new_file.css',
        checksum: '1010',
        value: 'content',
        stats: {size: 7, mtime: expect.any(Number)},
        attachment: '',
      })
    })

    test('"write" creates an image file on the local disk and updates the file map', async () => {
      // Given
      const root = 'src/cli/utilities/fixtures/theme'
      const attachment = '0x123!'
      const buffer = Buffer.from(attachment, 'base64')

      // When
      const themeFileSystem = mountThemeFileSystem(root)
      await themeFileSystem.ready()
      expect(themeFileSystem.files.get('assets/new_image.gif')).toBeUndefined()

      await themeFileSystem.write({key: 'assets/new_image.gif', checksum: '1010', attachment})

      // Then
      expect(writeFile).toBeCalledWith(`${root}/assets/new_image.gif`, buffer, {encoding: 'base64'})
      expect(themeFileSystem.files.get('assets/new_image.gif')).toEqual({
        key: 'assets/new_image.gif',
        checksum: '1010',
        attachment,
        value: '',
        stats: {size: 6, mtime: expect.any(Number)},
      })
    })

    test('write updates files map before the async writeFile call', async () => {
      // Given
      const root = 'src/cli/utilities/fixtures'
      const themeFileSystem = mountThemeFileSystem(root)
      await themeFileSystem.ready()

      const newAsset = {key: 'assets/new_file.css', checksum: '1010', value: 'content'}

      let filesUpdated = false
      vi.mocked(writeFile).mockImplementationOnce(() => {
        expect(themeFileSystem.files.get(newAsset.key)).toEqual({
          ...newAsset,
          attachment: '',
          stats: {size: 7, mtime: expect.any(Number)},
        })
        filesUpdated = true

        return Promise.resolve()
      })

      // When
      expect(themeFileSystem.files.has(newAsset.key)).toBe(false)
      await themeFileSystem.write(newAsset)

      // Then
      expect(filesUpdated).toBe(true)
    })
  })

  describe('themeFileSystem.read', async () => {
    test('"read" returns the content from the local disk and updates the file map', async () => {
      // Given
      const root = 'src/cli/utilities/fixtures/theme'
      const key = 'templates/404.json'
      const themeFileSystem = mountThemeFileSystem(root)
      await themeFileSystem.ready()
      const file = themeFileSystem.files.get(key)
      expect(file).toEqual({
        key: 'templates/404.json',
        checksum: '64caf742bd427adcf497bffab63df30c',
        value: expect.any(String),
        attachment: '',
        stats: {size: expect.any(Number), mtime: expect.any(Number)},
      })

      // When
      delete file?.value
      const content = await themeFileSystem.read(key)

      // Then
      expect(themeFileSystem.files.get(key)).toEqual({
        key: 'templates/404.json',
        checksum: '64caf742bd427adcf497bffab63df30c',
        value: content,
        attachment: '',
        stats: {size: content?.length, mtime: expect.any(Number)},
      })
    })
  })

  describe('themeFileSystem.applyIgnoreFilters', async () => {
    test('applies ignore filters to the theme files', async () => {
      const root = 'src/cli/utilities/fixtures'
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

  describe('readThemeFile', () => {
    test('reads theme file when it exists', async () => {
      // Given
      const root = 'src/cli/utilities/fixtures/theme'
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

    test(`returns undefined when theme file doesn't exist`, async () => {
      // Given
      const root = 'src/cli/utilities/fixtures/theme'
      const key = 'templates/invalid.json'

      // When
      const content = await readThemeFile(root, key)

      // Then
      expect(content).toBeUndefined()
    })

    test('returns Buffer for image files', async () => {
      // Given
      const root = 'src/cli/utilities/fixtures/theme'
      const key = 'assets/sparkle.gif'

      // When
      const content = await readThemeFile(root, key)

      // Then
      expect(content).toBeDefined()
      expect(Buffer.isBuffer(content)).toBe(true)
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
        {key: 'locales/en.default.json', checksum: '6'},
        {key: 'templates/404.json', checksum: '7'},
        {key: 'config/settings_schema.json', checksum: '8'},
        {key: 'config/settings_data.json', checksum: '9'},
        {key: 'sections/announcement-bar.liquid', checksum: '10'},
        {key: 'snippets/language-localization.liquid', checksum: '11'},
        {key: 'templates/404.context.uk.json', checksum: '11'},
        {key: 'blocks/block.liquid', checksum: '12'},
      ]
      // When
      const {
        sectionLiquidFiles,
        otherLiquidFiles,
        templateJsonFiles,
        otherJsonFiles,
        configFiles,
        staticAssetFiles,
        contextualizedJsonFiles,
        blockLiquidFiles,
      } = partitionThemeFiles(files)

      // Then
      expect(sectionLiquidFiles).toEqual([{key: 'sections/announcement-bar.liquid', checksum: '10'}])
      expect(otherLiquidFiles).toEqual([
        {key: 'assets/base.css.liquid', checksum: '2'},
        {key: 'layout/password.liquid', checksum: '4'},
        {key: 'layout/theme.liquid', checksum: '5'},
        {key: 'snippets/language-localization.liquid', checksum: '11'},
      ])
      expect(templateJsonFiles).toEqual([{key: 'templates/404.json', checksum: '7'}])
      expect(otherJsonFiles).toEqual([{key: 'locales/en.default.json', checksum: '6'}])
      expect(configFiles).toEqual([
        {key: 'config/settings_schema.json', checksum: '8'},
        {key: 'config/settings_data.json', checksum: '9'},
      ])
      expect(staticAssetFiles).toEqual([
        {key: 'assets/base.css', checksum: '1'},
        {key: 'assets/sparkle.gif', checksum: '3'},
      ])
      expect(contextualizedJsonFiles).toEqual([{key: 'templates/404.context.uk.json', checksum: '11'}])
      expect(blockLiquidFiles).toEqual([{key: 'blocks/block.liquid', checksum: '12'}])
    })

    test('should handle empty file array', () => {
      // Given
      const files: Checksum[] = []

      // When
      const {sectionLiquidFiles, otherLiquidFiles, templateJsonFiles, otherJsonFiles, configFiles, staticAssetFiles} =
        partitionThemeFiles(files)

      // Then
      expect(sectionLiquidFiles).toEqual([])
      expect(otherLiquidFiles).toEqual([])
      expect(templateJsonFiles).toEqual([])
      expect(otherJsonFiles).toEqual([])
      expect(configFiles).toEqual([])
      expect(staticAssetFiles).toEqual([])
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
      // Given
      const root = 'src/cli/utilities/fixtures/theme'

      // When
      const result = await hasRequiredThemeDirectories(root)

      // Then
      expect(result).toBeTruthy()
    })

    test(`returns false when directory doesn't have all required theme directories`, async () => {
      // Given
      const root = 'src/cli/utilities'

      // When
      const result = await hasRequiredThemeDirectories(root)

      // Then
      expect(result).toBeFalsy()
    })
  })

  describe('handleFileDelete', () => {
    const themeId = '1'
    const adminSession = {token: 'token', storeFqdn: 'store.myshopify.com'}
    const root = 'src/cli/utilities/fixtures/theme'

    beforeEach(() => {
      const mockWatcher = new EventEmitter()
      vi.spyOn(chokidar, 'watch').mockImplementation((_) => {
        return mockWatcher as any
      })
    })

    test('deletes file from remote theme', async () => {
      // Given
      vi.mocked(fetchThemeAssets).mockResolvedValue([
        {
          key: 'assets/base.css',
          checksum: '1',
          value: 'content',
          attachment: '',
          stats: {size: 100, mtime: 100},
        },
      ])
      vi.mocked(deleteThemeAsset).mockResolvedValue(true)

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
      expect(deleteThemeAsset).toHaveBeenCalledWith(Number(themeId), 'assets/base.css', adminSession)
    })

    test('does not delete file from remote when options.noDelete is true', async () => {
      // Given
      vi.mocked(fetchThemeAssets).mockResolvedValue([
        {
          key: 'assets/base.css',
          checksum: '1',
          value: 'content',
          attachment: '',
          stats: {size: 100, mtime: 100},
        },
      ])
      vi.mocked(deleteThemeAsset).mockResolvedValue(true)

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
      expect(deleteThemeAsset).not.toHaveBeenCalled()
    })

    test('renders a warning to debug if the file deletion fails', async () => {
      // Given
      vi.mocked(fetchThemeAssets).mockResolvedValue([
        {
          key: 'assets/base.css',
          value: 'file content',
          checksum: '1',
          stats: {size: 100, mtime: 100},
        },
      ])
      vi.mocked(deleteThemeAsset).mockResolvedValue(false)

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
      expect(deleteThemeAsset).toHaveBeenCalledWith(Number(themeId), 'assets/base.css', adminSession)
      expect(renderError).toHaveBeenCalledWith({
        headline: 'Failed to delete file "assets/base.css" from remote theme.',
        body: expect.any(String),
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
