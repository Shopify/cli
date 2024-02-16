import {
  hasRequiredThemeDirectories,
  isJson,
  isTextFile,
  isThemeAsset,
  mountThemeFileSystem,
  readThemeFile,
  removeThemeFile,
  writeThemeFile,
  partitionThemeFiles,
} from './theme-fs.js'
import {removeFile, writeFile} from '@shopify/cli-kit/node/fs'
import {Checksum} from '@shopify/cli-kit/node/themes/types'
import {test, describe, expect, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/fs', async (realImport) => {
  const realModule = await realImport<typeof import('@shopify/cli-kit/node/fs')>()
  const mockModule = {removeFile: vi.fn(), writeFile: vi.fn()}

  return {...realModule, ...mockModule}
})

describe('theme-fs', () => {
  describe('mountThemeFileSystem', async () => {
    test('mounts the local theme file system when the directory is valid', async () => {
      // Given
      const root = 'src/cli/utilities/fixtures'

      // When
      const themeFileSystem = await mountThemeFileSystem(root)

      // Then
      expect(themeFileSystem).toEqual({
        files: new Map([
          fsEntry({checksum: 'b7fbe0ecff2a6c1d6e697a13096e2b17', key: 'assets/base.css'}),
          fsEntry({checksum: '7adcd48a3cc215a81fabd9dafb919507', key: 'assets/sparkle.gif'}),
          fsEntry({checksum: '22e69af13b7953914563c60035a831bc', key: 'config/settings_data.json'}),
          fsEntry({checksum: '3f6b44e95dbcf0214a0a82627a37cd53', key: 'config/settings_schema.json'}),
          fsEntry({checksum: '7a92d18f1f58b2396c46f98f9e502c6a', key: 'layout/password.liquid'}),
          fsEntry({checksum: '2374357fdadd3b4636405e80e21e87fc', key: 'layout/theme.liquid'}),
          fsEntry({checksum: '94d575574a070397f297a2e9bb32ce7d', key: 'locales/en.default.json'}),
          fsEntry({checksum: '3e8fecc3fb5e886f082e12357beb5d56', key: 'sections/announcement-bar.liquid'}),
          fsEntry({checksum: 'aa0c697b712b22753f73c84ba8a2e35a', key: 'snippets/language-localization.liquid'}),
          fsEntry({checksum: 'f14a0bd594f4fee47b13fc09543098ff', key: 'templates/404.json'}),
        ]),
        root,
      })
    })

    test('mounts an empty file system when the directory is invalid', async () => {
      // Given
      const root = 'src/cli/utilities/invalid-directory'

      // When
      const themeFileSystem = await mountThemeFileSystem(root)

      // Then
      expect(themeFileSystem).toEqual({
        files: new Map([]),
        root,
      })
    })
  })

  describe('readThemeFile', () => {
    test('reads theme file when it exists', async () => {
      // Given
      const root = 'src/cli/utilities/fixtures'
      const key = 'templates/404.json'

      // When
      const content = await readThemeFile(root, key)
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
      const root = 'src/cli/utilities/fixtures'
      const key = 'templates/invalid.json'

      // When
      const content = await readThemeFile(root, key)

      // Then
      expect(content).toBeUndefined()
    })

    test('returns Buffer for image files', async () => {
      // Given
      const root = 'src/cli/utilities/fixtures'
      const key = 'assets/sparkle.gif'

      // When
      const content = await readThemeFile(root, key)

      // Then
      expect(content).toBeDefined()
      expect(Buffer.isBuffer(content)).toBe(true)
    })
  })

  describe('writeThemeFile', () => {
    test(`writes theme file when it's a text file`, async () => {
      // Given
      const root = 'src/cli/utilities/fixtures'
      const key = 'templates/500.json'

      // When
      await writeThemeFile(root, {key, value: '{"key": "http://value.com"}', checksum: '123'})

      // Then
      expect(writeFile).toBeCalledWith('src/cli/utilities/fixtures/templates/500.json', '{"key": "http://value.com"}')
    })

    test(`writes theme file when it's an image`, async () => {
      // Given
      const root = 'src/cli/utilities/fixtures'
      const key = 'templates/500.json'
      const attachment = '0x123!'
      const buffer = Buffer.from(attachment, 'base64')

      // When
      await writeThemeFile(root, {key, attachment, checksum: '123'})

      // Then
      expect(writeFile).toBeCalledWith('src/cli/utilities/fixtures/templates/500.json', buffer, {encoding: 'base64'})
    })
  })

  describe('removeThemeFile', () => {
    test('removes theme file when it exists', async () => {
      // Given
      const root = 'src/cli/utilities/fixtures'
      const key = 'templates/404.json'

      // When
      await removeThemeFile(root, key)

      // Then
      expect(removeFile).toBeCalledWith('src/cli/utilities/fixtures/templates/404.json')
    })

    test(`do nothing when theme file doesn't exist`, async () => {
      // Given
      const root = 'src/cli/utilities/fixtures'
      const key = 'templates/401.json'

      // When
      await removeThemeFile(root, key)

      // Then
      expect(removeFile).not.toBeCalled()
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
      const files = [
        'assets/base.css',
        'assets/base.css.liquid',
        'assets/sparkle.gif',
        'layout/password.liquid',
        'layout/theme.liquid',
        'locales/en.default.json',
        'templates/404.json',
        'config/settings_schema.json',
        'config/settings_data.json',
        'sections/announcement-bar.liquid',
        'snippets/language-localization.liquid',
      ]

      // When
      const {liquidFiles, jsonFiles, configFiles, staticAssetFiles} = partitionThemeFiles(files)

      // Then
      expect(liquidFiles).toEqual([
        'assets/base.css.liquid',
        'layout/password.liquid',
        'layout/theme.liquid',
        'sections/announcement-bar.liquid',
        'snippets/language-localization.liquid',
      ])
      expect(jsonFiles).toEqual(['locales/en.default.json', 'templates/404.json'])
      expect(configFiles).toEqual(['config/settings_schema.json', 'config/settings_data.json'])
      expect(staticAssetFiles).toEqual(['assets/base.css', 'assets/sparkle.gif'])
    })

    test('should handle empty file array', () => {
      // Given
      const files: string[] = []

      // When
      const {liquidFiles, jsonFiles, configFiles, staticAssetFiles} = partitionThemeFiles(files)

      // Then
      expect(liquidFiles).toEqual([])
      expect(jsonFiles).toEqual([])
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
      const root = 'src/cli/utilities/fixtures'

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

  function fsEntry({key, checksum}: Checksum): [string, Checksum] {
    return [key, {key, checksum}]
  }
})
