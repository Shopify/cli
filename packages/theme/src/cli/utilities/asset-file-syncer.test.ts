import {LOCAL_STRATEGY, REMOTE_STRATEGY, initializeThemeEditorSync} from './asset-file-syncer.js'
import {uploadTheme} from './theme-uploader.js'
import {mountThemeFileSystem, removeThemeFile} from './theme-fs.js'
import {deleteThemeAsset, fetchThemeAsset} from '@shopify/cli-kit/node/themes/api'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {Checksum, ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'
import {DEVELOPMENT_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'
import {renderSelectPrompt} from '@shopify/cli-kit/node/ui'
import {describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('./theme-fs.js')
vi.mock('./theme-downloader.js')
vi.mock('./theme-uploader.js')

describe('initializeThemeEditorSync', () => {
  const developmentTheme = buildTheme({id: 1, name: 'Theme', role: DEVELOPMENT_THEME_ROLE})!
  const adminSession = {token: '', storeFqdn: ''}
  const remoteChecksums: Checksum[] = []
  const localThemeFileSystem = {
    root: 'tmp',
    files: new Map([]),
  } as ThemeFileSystem

  describe('files only present on remote developer theme', () => {
    test('should download assets from remote theme if themeEditorSync flag is passed and `remote` source is selected', async () => {
      // Given
      vi.mocked(renderSelectPrompt).mockResolvedValue(REMOTE_STRATEGY)
      const remoteChecksums = [{checksum: '2', key: 'templates/second_asset.json'}]

      // When
      await initializeThemeEditorSync(developmentTheme, adminSession, remoteChecksums, localThemeFileSystem)

      // Then
      expect(fetchThemeAsset).toHaveBeenCalledWith(developmentTheme.id, 'templates/second_asset.json', adminSession)
      expect(deleteThemeAsset).not.toHaveBeenCalled()
    })

    test('should delete assets from local disk if themeEditorSync flag is passed and `local` source is selected', async () => {
      // Given
      vi.mocked(renderSelectPrompt).mockResolvedValue(LOCAL_STRATEGY)
      const remoteChecksums = [{checksum: '2', key: 'templates/second_asset.json'}]

      // When
      await initializeThemeEditorSync(developmentTheme, adminSession, remoteChecksums, localThemeFileSystem)

      // Then
      expect(fetchThemeAsset).not.toHaveBeenCalled()
      expect(deleteThemeAsset).toHaveBeenCalled()
    })
  })

  describe('files only present on local developer theme', () => {
    test('should delete files from local disk if themeEditorSync flag is passed and `remote` source is selected', async () => {
      // Given
      vi.mocked(renderSelectPrompt).mockResolvedValue(REMOTE_STRATEGY)
      const localThemeFileSystem = {
        root: 'tmp',
        files: new Map([['templates/asset.json', {checksum: '1', key: 'templates/asset.json'}]]),
      } as ThemeFileSystem

      // When
      await initializeThemeEditorSync(developmentTheme, adminSession, remoteChecksums, localThemeFileSystem)

      // Then
      expect(removeThemeFile).toHaveBeenCalled()
      expect(uploadTheme).not.toHaveBeenCalled()
    })

    test('should upload files to remote theme if themeEditorSync flag is passed and `local` source is selected', async () => {
      // Given
      vi.mocked(renderSelectPrompt).mockResolvedValue(LOCAL_STRATEGY)
      const localThemeFileSystem = {
        root: 'tmp',
        files: new Map([['templates/asset.json', {checksum: '1', key: 'templates/asset.json'}]]),
      } as ThemeFileSystem

      // When
      await initializeThemeEditorSync(developmentTheme, adminSession, remoteChecksums, localThemeFileSystem)

      // Then
      expect(removeThemeFile).not.toHaveBeenCalled()
      expect(uploadTheme).toHaveBeenCalled()
    })
  })

  describe('files with conflicting checksums', () => {
    test('should download files from remote theme if themeEditorSync flag is passed and `remote` source is selected', async () => {
      // Given
      vi.mocked(renderSelectPrompt).mockResolvedValue(REMOTE_STRATEGY)
      const localThemeFileSystem = {
        root: 'tmp',
        files: new Map([['templates/asset.json', {checksum: '1', key: 'templates/asset.json'}]]),
      } as ThemeFileSystem
      const remoteChecksums = [{checksum: '2', key: 'templates/asset.json'}]

      // When
      await initializeThemeEditorSync(developmentTheme, adminSession, remoteChecksums, localThemeFileSystem)

      // Then
      expect(uploadTheme).not.toHaveBeenCalled()
      expect(fetchThemeAsset).toHaveBeenCalled()
    })

    test('should upload files from local disk if themeEditorSync flag is passed and `local` source is selected', async () => {
      // Given
      vi.mocked(renderSelectPrompt).mockResolvedValue(LOCAL_STRATEGY)
      const localThemeFileSystem = {
        root: 'tmp',
        files: new Map([['templates/asset.json', {checksum: '1', key: 'templates/asset.json'}]]),
      } as ThemeFileSystem
      const remoteChecksums = [{checksum: '2', key: 'templates/asset.json'}]

      // When
      await initializeThemeEditorSync(developmentTheme, adminSession, remoteChecksums, localThemeFileSystem)

      // Then
      expect(uploadTheme).toHaveBeenCalled()
      expect(fetchThemeAsset).not.toHaveBeenCalled()
    })
  })

  test('should remount the theme file system after reconciling files', async () => {
    // Given
    vi.mocked(renderSelectPrompt).mockResolvedValue(REMOTE_STRATEGY)
    const remoteChecksums = [{checksum: '2', key: 'templates/second_asset.json'}]

    // When
    await initializeThemeEditorSync(developmentTheme, adminSession, remoteChecksums, localThemeFileSystem)

    // Then
    expect(fetchThemeAsset).toHaveBeenCalled()
    expect(mountThemeFileSystem).toHaveBeenCalled()
  })

  test('should not remount the theme file system if no files are reconciled', async () => {
    // Given
    vi.mocked(renderSelectPrompt).mockResolvedValue(REMOTE_STRATEGY)
    const remoteChecksums: Checksum[] = []

    // When
    await initializeThemeEditorSync(developmentTheme, adminSession, remoteChecksums, localThemeFileSystem)

    // Then
    expect(fetchThemeAsset).not.toHaveBeenCalled()
    expect(mountThemeFileSystem).not.toHaveBeenCalled()
  })
})
