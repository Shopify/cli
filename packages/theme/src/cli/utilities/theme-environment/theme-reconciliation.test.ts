import {reconcileJsonFiles} from './theme-reconciliation.js'
import {REMOTE_STRATEGY, LOCAL_STRATEGY} from './remote-theme-watcher.js'
import {fakeThemeFileSystem} from '../theme-fs/theme-fs-mock-factory.js'
import {deleteThemeAssets, fetchThemeAssets} from '@shopify/cli-kit/node/themes/api'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {Checksum, ThemeAsset, ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'
import {DEVELOPMENT_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'
import {renderSelectPrompt} from '@shopify/cli-kit/node/ui'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('./theme-fs.js')
vi.mock('./theme-downloader.js')
vi.mock('./theme-uploader.js')

describe('reconcileJsonFiles', () => {
  const developmentTheme = buildTheme({id: 1, name: 'Theme', role: DEVELOPMENT_THEME_ROLE})!
  const adminSession = {token: '', storeFqdn: ''}
  const remoteChecksums: Checksum[] = [{checksum: '1', key: 'config/settings_schema.json'}]
  const files = new Map<string, ThemeAsset>([])
  const defaultOptions = {noDelete: false, only: [], ignore: []}

  let defaultThemeFileSystem: ThemeFileSystem

  beforeEach(() => {
    defaultThemeFileSystem = fakeThemeFileSystem('tmp', new Map<string, ThemeAsset>([]))
  })

  describe('file filters', () => {
    test('should only reconcile JSON files', async () => {
      // Given
      vi.mocked(renderSelectPrompt).mockResolvedValue(REMOTE_STRATEGY)
      vi.mocked(fetchThemeAssets).mockResolvedValue([{checksum: '1', key: 'templates/template.json', value: 'content'}])

      const remoteChecksums = [
        {checksum: '1', key: 'templates/template.json', value: 'content'},
        {checksum: '2', key: 'sections/section.liquid', value: 'content'},
        {checksum: '3', key: 'assets/asset.css', value: 'content'},
      ]

      // When
      await reconcileAndWaitForReconciliationFinish(
        developmentTheme,
        adminSession,
        remoteChecksums,
        defaultThemeFileSystem,
        defaultOptions,
      )

      // Then
      expect(fetchThemeAssets).toHaveBeenCalledTimes(1)
      expect(fetchThemeAssets).toHaveBeenCalledWith(developmentTheme.id, ['templates/template.json'], adminSession)
    })

    test('should only reconcile files that match the `only` option', async () => {
      // Given
      vi.mocked(renderSelectPrompt).mockResolvedValue(REMOTE_STRATEGY)
      vi.mocked(fetchThemeAssets).mockResolvedValue([{checksum: '1', key: 'templates/template.json', value: 'content'}])

      const remoteChecksums = [
        {checksum: '1', key: 'templates/template.json', value: 'content'},
        {checksum: '2', key: 'sections/section.liquid', value: 'content'},
        {checksum: '3', key: 'assets/asset.css', value: 'content'},
        {checksum: '4', key: 'templates/gift_card.liquid', value: 'content'},
      ]

      // When
      await reconcileAndWaitForReconciliationFinish(
        developmentTheme,
        adminSession,
        remoteChecksums,
        defaultThemeFileSystem,
        {
          ...defaultOptions,
          only: ['templates/*'],
        },
      )

      // Then
      expect(fetchThemeAssets).toHaveBeenCalledTimes(1)
      expect(fetchThemeAssets).toHaveBeenCalledWith(developmentTheme.id, ['templates/template.json'], adminSession)
    })

    test('should not reconcile files that match the `ignore` option', async () => {
      // Given
      const themeFileSystem = fakeThemeFileSystem('tmp', files, {filters: {ignore: ['templates/*']}})
      vi.mocked(renderSelectPrompt).mockResolvedValue(REMOTE_STRATEGY)
      const remoteChecksums = [
        {checksum: '1', key: 'templates/template.json', value: 'content'},
        {checksum: '2', key: 'sections/section.liquid', value: 'content'},
        {checksum: '3', key: 'assets/asset.css', value: 'content'},
        {checksum: '4', key: 'templates/gift_card.liquid', value: 'content'},
      ]

      // When
      await reconcileJsonFiles(developmentTheme, adminSession, remoteChecksums, themeFileSystem, {
        ...defaultOptions,
      })

      // Then
      expect(fetchThemeAssets).toHaveBeenCalledTimes(0)
    })
  })

  describe('files only present on remote developer theme', () => {
    test('should download assets from remote theme when `remote` source is selected', async () => {
      // Given
      vi.mocked(renderSelectPrompt).mockResolvedValue(REMOTE_STRATEGY)
      const assetToBeDownloaded = {checksum: '2', key: 'templates/second_asset.json', value: 'content'}
      const remoteChecksums = assetToBeDownloaded

      vi.mocked(fetchThemeAssets).mockResolvedValue([assetToBeDownloaded])

      // When
      expect(defaultThemeFileSystem.files.get('templates/asset.json')).toBeUndefined()
      await reconcileAndWaitForReconciliationFinish(
        developmentTheme,
        adminSession,
        [remoteChecksums],
        defaultThemeFileSystem,
        defaultOptions,
      )

      // Then
      expect(fetchThemeAssets).toHaveBeenCalledWith(developmentTheme.id, [assetToBeDownloaded.key], adminSession)
      expect(defaultThemeFileSystem.files.get('templates/second_asset.json')).toEqual(assetToBeDownloaded)
    })

    test('should delete assets from local disk when `local` source is selected', async () => {
      // Given
      vi.mocked(renderSelectPrompt).mockResolvedValue(LOCAL_STRATEGY)
      const assetToBeDeleted = {checksum: '2', key: 'templates/asset.json'}
      const remoteChecksums = [assetToBeDeleted]

      // When
      await reconcileAndWaitForReconciliationFinish(
        developmentTheme,
        adminSession,
        remoteChecksums,
        defaultThemeFileSystem,
        defaultOptions,
      )

      // Then
      expect(deleteThemeAssets).toHaveBeenCalledWith(developmentTheme.id, [assetToBeDeleted.key], adminSession)
      expect(defaultThemeFileSystem.files.get('templates/asset.json')).toBeUndefined()
    })
  })

  describe('files only present on local developer theme', () => {
    test('should delete files from local disk when `remote` source is selected', async () => {
      // Given
      vi.mocked(renderSelectPrompt).mockResolvedValue(REMOTE_STRATEGY)
      vi.mocked(fetchThemeAssets).mockResolvedValue([])

      const files = new Map([['templates/asset.json', {checksum: '1', key: 'templates/asset.json'}]])
      const localThemeFileSystem = fakeThemeFileSystem('tmp', files)
      const spy = vi.spyOn(localThemeFileSystem, 'delete')

      // When
      await reconcileAndWaitForReconciliationFinish(
        developmentTheme,
        adminSession,
        remoteChecksums,
        localThemeFileSystem,
        defaultOptions,
      )

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
      await reconcileAndWaitForReconciliationFinish(
        developmentTheme,
        adminSession,
        remoteChecksums,
        localThemeFileSystem,
        defaultOptions,
      )

      // Then
      expect(spy).not.toHaveBeenCalled()
    })

    test('should skip local file prompt when nodelete option is true', async () => {
      // Given
      const files = new Map([['templates/asset.json', {checksum: '1', key: 'templates/asset.json'}]])
      const localThemeFileSystem = fakeThemeFileSystem('tmp', files)
      const spy = vi.spyOn(localThemeFileSystem, 'delete')

      // When
      await reconcileAndWaitForReconciliationFinish(
        developmentTheme,
        adminSession,
        remoteChecksums,
        localThemeFileSystem,
        {
          ...defaultOptions,
          noDelete: true,
        },
      )

      // Then
      expect(renderSelectPrompt).not.toHaveBeenCalledWith(
        expect.any(Array),
        'The files listed below are only present locally. What would you like to do?',
        expect.any(Object),
      )
      expect(spy).not.toHaveBeenCalledWith()
    })
  })

  describe('files with conflicting checksums', () => {
    test('should download files from remote theme when `remote` source is selected', async () => {
      // Given
      vi.mocked(renderSelectPrompt).mockResolvedValue(REMOTE_STRATEGY)
      vi.mocked(fetchThemeAssets).mockResolvedValue([{checksum: '1', key: 'templates/asset.json', value: 'content'}])

      const files = new Map([['templates/asset.json', {checksum: '1', key: 'templates/asset.json'}]])
      const localThemeFileSystem = fakeThemeFileSystem('tmp', files)
      const remoteChecksums = [{checksum: '2', key: 'templates/asset.json'}]

      // When
      await reconcileAndWaitForReconciliationFinish(
        developmentTheme,
        adminSession,
        remoteChecksums,
        localThemeFileSystem,
        defaultOptions,
      )

      // Then
      expect(fetchThemeAssets).toHaveBeenCalled()
    })

    test('should not download files from remote when `local` source is selected', async () => {
      // Given
      vi.mocked(renderSelectPrompt).mockResolvedValue(LOCAL_STRATEGY)
      const files = new Map([['templates/asset.json', {checksum: '1', key: 'templates/asset.json'}]])
      const localThemeFileSystem = fakeThemeFileSystem('tmp', files)
      const remoteChecksums = [{checksum: '2', key: 'templates/asset.json'}]

      // When
      await reconcileAndWaitForReconciliationFinish(
        developmentTheme,
        adminSession,
        remoteChecksums,
        localThemeFileSystem,
        defaultOptions,
      )

      // Then
      expect(fetchThemeAssets).not.toHaveBeenCalled()
    })
  })

  test('should not perform any work when remote checksums are empty', async () => {
    // Given
    const files = new Map<string, ThemeAsset>([])
    const defaultThemeFileSystem = fakeThemeFileSystem('tmp', files)
    const emptyRemoteChecksums: Checksum[] = []

    // When
    await reconcileAndWaitForReconciliationFinish(
      developmentTheme,
      adminSession,
      emptyRemoteChecksums,
      defaultThemeFileSystem,
      defaultOptions,
    )

    // Then
    expect(renderSelectPrompt).not.toHaveBeenCalled()
  })
})

async function reconcileAndWaitForReconciliationFinish(...args: Parameters<typeof reconcileJsonFiles>) {
  const {workPromise} = await reconcileJsonFiles(...args)
  return workPromise
}
