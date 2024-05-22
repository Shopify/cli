import {reconcileJsonFiles} from './theme-reconciliation.js'
import {REMOTE_STRATEGY, LOCAL_STRATEGY} from './remote-theme-watcher.js'
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

describe('reconcileThemeFiles', () => {
  const developmentTheme = buildTheme({id: 1, name: 'Theme', role: DEVELOPMENT_THEME_ROLE})!
  const adminSession = {token: '', storeFqdn: ''}
  const remoteChecksums: Checksum[] = []
  const files = new Map<string, ThemeAsset>([])
  const defaultThemeFileSystem = fakeThemeFileSystem('tmp', files)

  describe('file filters', () => {
    test('should only reconcile JSON files', async () => {
      // Given
      vi.mocked(renderSelectPrompt).mockResolvedValue(REMOTE_STRATEGY)
      const remoteChecksums = [
        {checksum: '1', key: 'templates/template.json', value: 'content'},
        {checksum: '2', key: 'sections/section.liquid', value: 'content'},
        {checksum: '3', key: 'assets/asset.css', value: 'content'},
      ]

      // When
      await reconcileJsonFiles(developmentTheme, adminSession, remoteChecksums, defaultThemeFileSystem)

      // Then
      expect(fetchThemeAsset).toHaveBeenCalledTimes(1)
      expect(fetchThemeAsset).toHaveBeenCalledWith(developmentTheme.id, 'templates/template.json', adminSession)
    })

    test('should only reconcile files that match the `only` option', async () => {
      // Given
      vi.mocked(renderSelectPrompt).mockResolvedValue(REMOTE_STRATEGY)
      const remoteChecksums = [
        {checksum: '1', key: 'templates/template.json', value: 'content'},
        {checksum: '2', key: 'sections/section.liquid', value: 'content'},
        {checksum: '3', key: 'assets/asset.css', value: 'content'},
        {checksum: '4', key: 'templates/gift_card.liquid', value: 'content'},
      ]

      // When
      await reconcileJsonFiles(developmentTheme, adminSession, remoteChecksums, defaultThemeFileSystem, {
        only: ['templates/*'],
      })

      // Then
      expect(fetchThemeAsset).toHaveBeenCalledTimes(1)
      expect(fetchThemeAsset).toHaveBeenCalledWith(developmentTheme.id, 'templates/template.json', adminSession)
    })

    // should respect the `ignore` option
    test('should not reconcile files that match the `ignore` option', async () => {
      // Given
      vi.mocked(renderSelectPrompt).mockResolvedValue(REMOTE_STRATEGY)
      const remoteChecksums = [
        {checksum: '1', key: 'templates/template.json', value: 'content'},
        {checksum: '2', key: 'sections/section.liquid', value: 'content'},
        {checksum: '3', key: 'assets/asset.css', value: 'content'},
        {checksum: '4', key: 'templates/gift_card.liquid', value: 'content'},
      ]

      // When
      await reconcileJsonFiles(developmentTheme, adminSession, remoteChecksums, defaultThemeFileSystem, {
        ignore: ['templates/*'],
      })

      // Then
      expect(fetchThemeAsset).toHaveBeenCalledTimes(0)
    })
  })

  describe('files only present on remote developer theme', () => {
    test('should download assets from remote theme when `remote` source is selected', async () => {
      // Given
      vi.mocked(renderSelectPrompt).mockResolvedValue(REMOTE_STRATEGY)
      const assetToBeDownloaded = {checksum: '2', key: 'templates/second_asset.json', value: 'content'}
      const remoteChecksums = [assetToBeDownloaded]

      vi.mocked(fetchThemeAsset).mockResolvedValue(assetToBeDownloaded)

      // When
      expect(defaultThemeFileSystem.files.get('templates/asset.json')).toBeUndefined()
      await reconcileJsonFiles(developmentTheme, adminSession, remoteChecksums, defaultThemeFileSystem)

      // Then
      expect(fetchThemeAsset).toHaveBeenCalledWith(developmentTheme.id, assetToBeDownloaded.key, adminSession)
      expect(defaultThemeFileSystem.files.get('templates/second_asset.json')).toEqual(assetToBeDownloaded)
    })

    test('should delete assets from local disk when `local` source is selected', async () => {
      // Given
      vi.mocked(renderSelectPrompt).mockResolvedValue(LOCAL_STRATEGY)
      const assetToBeDeleted = {checksum: '2', key: 'templates/asset.json'}
      const remoteChecksums = [assetToBeDeleted]

      // When
      await reconcileJsonFiles(developmentTheme, adminSession, remoteChecksums, defaultThemeFileSystem)

      // Then
      expect(deleteThemeAsset).toHaveBeenCalledWith(developmentTheme.id, assetToBeDeleted.key, adminSession)
      expect(defaultThemeFileSystem.files.get('templates/asset.json')).toBeUndefined()
    })
  })

  describe('files only present on local developer theme', () => {
    test('should delete files from local disk when `remote` source is selected', async () => {
      // Given
      vi.mocked(renderSelectPrompt).mockResolvedValue(REMOTE_STRATEGY)
      const files = new Map([['templates/asset.json', {checksum: '1', key: 'templates/asset.json'}]])
      const localThemeFileSystem = fakeThemeFileSystem('tmp', files)
      const spy = vi.spyOn(localThemeFileSystem, 'delete')

      // When
      await reconcileJsonFiles(developmentTheme, adminSession, remoteChecksums, localThemeFileSystem)

      // Then
      expect(spy).toHaveBeenCalledWith('templates/asset.json')
    })

    test('should not delete files from local disk when `local` source is selected', async () => {
      // Given
      vi.mocked(renderSelectPrompt).mockResolvedValue(LOCAL_STRATEGY)
      const files = new Map([['templates/asset.json', {checksum: '1', key: 'templates/asset.json'}]])
      const localThemeFileSystem = fakeThemeFileSystem('tmp', files)
      const spy = vi.spyOn(localThemeFileSystem, 'delete')

      // When
      await reconcileJsonFiles(developmentTheme, adminSession, remoteChecksums, localThemeFileSystem)

      // Then
      expect(spy).not.toHaveBeenCalled()
    })

    test('should skip local file prompt when nodelete option is true', async () => {
      // Given
      const files = new Map([['templates/asset.json', {checksum: '1', key: 'templates/asset.json'}]])
      const localThemeFileSystem = fakeThemeFileSystem('tmp', files)
      const spy = vi.spyOn(localThemeFileSystem, 'delete')

      // When
      await reconcileJsonFiles(developmentTheme, adminSession, remoteChecksums, localThemeFileSystem, {noDelete: true})

      // Then
      expect(renderSelectPrompt).not.toHaveBeenCalled()
      expect(spy).not.toHaveBeenCalledWith()
    })
  })

  describe('files with conflicting checksums', () => {
    test('should download files from remote theme when `remote` source is selected', async () => {
      // Given
      vi.mocked(renderSelectPrompt).mockResolvedValue(REMOTE_STRATEGY)
      const files = new Map([['templates/asset.json', {checksum: '1', key: 'templates/asset.json'}]])
      const localThemeFileSystem = fakeThemeFileSystem('tmp', files)
      const remoteChecksums = [{checksum: '2', key: 'templates/asset.json'}]

      // When
      await reconcileJsonFiles(developmentTheme, adminSession, remoteChecksums, localThemeFileSystem)

      // Then
      expect(fetchThemeAsset).toHaveBeenCalled()
    })

    test('should not download files from remote when `local` source is selected', async () => {
      // Given
      vi.mocked(renderSelectPrompt).mockResolvedValue(LOCAL_STRATEGY)
      const files = new Map([['templates/asset.json', {checksum: '1', key: 'templates/asset.json'}]])
      const localThemeFileSystem = fakeThemeFileSystem('tmp', files)
      const remoteChecksums = [{checksum: '2', key: 'templates/asset.json'}]

      // When
      await reconcileJsonFiles(developmentTheme, adminSession, remoteChecksums, localThemeFileSystem)

      // Then
      expect(fetchThemeAsset).not.toHaveBeenCalled()
    })
  })
})
