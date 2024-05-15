import {LOCAL_STRATEGY, REMOTE_STRATEGY, initializeThemeEditorSync} from './asset-file-syncer.js'
import {uploadTheme} from '../theme-uploader.js'
import {fakeThemeFileSystem} from '../theme-fs/theme-fs-mock-factory.js'
import {deleteThemeAsset, fetchThemeAsset} from '@shopify/cli-kit/node/themes/api'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {Checksum, ThemeAsset} from '@shopify/cli-kit/node/themes/types'
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
  const files = new Map<string, ThemeAsset>([])
  const defaultThemeFileSystem = fakeThemeFileSystem('tmp', files)

  describe('files only present on remote developer theme', () => {
    test('should download assets from remote theme if themeEditorSync flag is passed and `remote` source is selected', async () => {
      // Given
      vi.mocked(renderSelectPrompt).mockResolvedValue(REMOTE_STRATEGY)
      const assetToBeDownloaded = {checksum: '2', key: 'templates/second_asset.json', value: 'content'}
      const remoteChecksums = [assetToBeDownloaded]

      vi.mocked(fetchThemeAsset).mockResolvedValue(assetToBeDownloaded)

      // When
      expect(defaultThemeFileSystem.files.get('templates/asset.json')).toBeUndefined()
      await initializeThemeEditorSync(developmentTheme, adminSession, remoteChecksums, defaultThemeFileSystem)

      // Then
      expect(fetchThemeAsset).toHaveBeenCalledWith(developmentTheme.id, assetToBeDownloaded.key, adminSession)
      expect(defaultThemeFileSystem.files.get('templates/second_asset.json')).toEqual(assetToBeDownloaded)
    })

    test('should delete assets from local disk if themeEditorSync flag is passed and `local` source is selected', async () => {
      // Given
      vi.mocked(renderSelectPrompt).mockResolvedValue(LOCAL_STRATEGY)
      const assetToBeDeleted = {checksum: '2', key: 'templates/asset.json'}
      const remoteChecksums = [assetToBeDeleted]

      // When
      await initializeThemeEditorSync(developmentTheme, adminSession, remoteChecksums, defaultThemeFileSystem)

      // Then
      expect(deleteThemeAsset).toHaveBeenCalledWith(developmentTheme.id, assetToBeDeleted.key, adminSession)
      expect(defaultThemeFileSystem.files.get('templates/asset.json')).toBeUndefined()
    })
  })

  describe('files only present on local developer theme', () => {
    test('should delete files from local disk if themeEditorSync flag is passed and `remote` source is selected', async () => {
      // Given
      vi.mocked(renderSelectPrompt).mockResolvedValue(REMOTE_STRATEGY)
      const files = new Map([['templates/asset.json', {checksum: '1', key: 'templates/asset.json'}]])
      const localThemeFileSystem = fakeThemeFileSystem('tmp', files)
      const spy = vi.spyOn(localThemeFileSystem, 'delete')

      // When
      await initializeThemeEditorSync(developmentTheme, adminSession, remoteChecksums, localThemeFileSystem)

      // Then
      expect(spy).toHaveBeenCalledWith('templates/asset.json')
      expect(uploadTheme).not.toHaveBeenCalled()
    })

    test('should upload files to remote theme if themeEditorSync flag is passed and `local` source is selected', async () => {
      // Given
      vi.mocked(renderSelectPrompt).mockResolvedValue(LOCAL_STRATEGY)
      const files = new Map([['templates/asset.json', {checksum: '1', key: 'templates/asset.json'}]])
      const localThemeFileSystem = fakeThemeFileSystem('tmp', files)
      const spy = vi.spyOn(localThemeFileSystem, 'delete')

      // When
      await initializeThemeEditorSync(developmentTheme, adminSession, remoteChecksums, localThemeFileSystem)

      // Then
      expect(spy).not.toHaveBeenCalled()
      expect(uploadTheme).toHaveBeenCalledWith(developmentTheme, adminSession, remoteChecksums, localThemeFileSystem, {
        nodelete: true,
      })
    })
  })

  describe('files with conflicting checksums', () => {
    test('should download files from remote theme if themeEditorSync flag is passed and `remote` source is selected', async () => {
      // Given
      vi.mocked(renderSelectPrompt).mockResolvedValue(REMOTE_STRATEGY)
      const files = new Map([['templates/asset.json', {checksum: '1', key: 'templates/asset.json'}]])
      const localThemeFileSystem = fakeThemeFileSystem('tmp', files)
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
      const files = new Map([['templates/asset.json', {checksum: '1', key: 'templates/asset.json'}]])
      const localThemeFileSystem = fakeThemeFileSystem('tmp', files)
      const remoteChecksums = [{checksum: '2', key: 'templates/asset.json'}]

      // When
      await initializeThemeEditorSync(developmentTheme, adminSession, remoteChecksums, localThemeFileSystem)

      // Then
      expect(uploadTheme).toHaveBeenCalled()
      expect(fetchThemeAsset).not.toHaveBeenCalled()
    })
  })
})
