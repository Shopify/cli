import {PollingOptions, pollRemoteJsonChanges, deleteRemovedAssets} from './theme-polling.js'
import {fakeThemeFileSystem} from '../theme-fs/theme-fs-mock-factory.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fetchChecksums, fetchThemeAssets} from '@shopify/cli-kit/node/themes/api'
import {Checksum, ThemeAsset} from '@shopify/cli-kit/node/themes/types'
import {describe, expect, test, vi} from 'vitest'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {DEVELOPMENT_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'

vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('../theme-fs.js')

describe('pollRemoteJsonChanges', async () => {
  const developmentTheme = buildTheme({id: 1, name: 'Theme', role: DEVELOPMENT_THEME_ROLE})!
  const adminSession = {token: '', storeFqdn: ''}
  const defaultOptions: PollingOptions = {noDelete: false}

  test('downloads modified files from the remote theme', async () => {
    // Given
    const themeFileSystem = fakeThemeFileSystem('tmp', new Map())
    const remoteChecksums = [{checksum: '1', key: 'templates/asset.json'}]
    const updatedRemoteChecksums = [{checksum: '2', key: 'templates/asset.json'}]
    vi.mocked(fetchChecksums).mockResolvedValue(updatedRemoteChecksums)
    vi.mocked(fetchThemeAssets).mockResolvedValue([{checksum: '2', key: 'templates/asset.json', value: 'content'}])

    // When
    await pollRemoteJsonChanges(developmentTheme, adminSession, remoteChecksums, themeFileSystem, defaultOptions)

    // Then
    expect(themeFileSystem.files.get('templates/asset.json')).toEqual({
      checksum: '2',
      key: 'templates/asset.json',
      value: 'content',
    })
  })

  test('downloads newly added files from remote theme', async () => {
    // Given
    const themeFileSystem = fakeThemeFileSystem('tmp', new Map())
    const remoteChecksums: Checksum[] = []
    const updatedRemoteChecksums = [{checksum: '1', key: 'templates/asset.json'}]
    vi.mocked(fetchChecksums).mockResolvedValue(updatedRemoteChecksums)
    vi.mocked(fetchThemeAssets).mockResolvedValue([{checksum: '1', key: 'templates/asset.json', value: 'content'}])

    // When
    await pollRemoteJsonChanges(developmentTheme, adminSession, remoteChecksums, themeFileSystem, defaultOptions)

    // Then
    expect(themeFileSystem.files.get('templates/asset.json')).toEqual({
      checksum: '1',
      key: 'templates/asset.json',
      value: 'content',
    })
  })

  test('does not download newly added files from remote theme when file with equivalent checksum is already presenty locally', async () => {
    // Given
    const remoteChecksums: Checksum[] = []
    const updatedRemoteChecksums = [{checksum: '1', key: 'templates/asset.json'}]
    vi.mocked(fetchChecksums).mockResolvedValue(updatedRemoteChecksums)
    const themeFileSystem = fakeThemeFileSystem(
      'tmp',
      new Map([['templates/asset.json', {checksum: '1', key: 'templates/asset.json', value: 'content'}]]),
    )

    // When
    await pollRemoteJsonChanges(developmentTheme, adminSession, remoteChecksums, themeFileSystem, defaultOptions)

    // Then
    expect(themeFileSystem.files.get('templates/asset.json')).toEqual({
      checksum: '1',
      key: 'templates/asset.json',
      value: 'content',
    })
  })

  test('deletes local file when files is deleted on remote', async () => {
    // Given
    const remoteChecksums = [{checksum: '1', key: 'templates/asset.json'}]
    const files = new Map<string, ThemeAsset>([['templates/asset.json', {checksum: '1', key: 'templates/asset.json'}]])
    const themeFileSystem = fakeThemeFileSystem('tmp', files)
    vi.mocked(fetchChecksums).mockResolvedValue([])

    // When
    await pollRemoteJsonChanges(developmentTheme, adminSession, remoteChecksums, themeFileSystem, {
      ...defaultOptions,
      noDelete: false,
    })

    // Then
    expect(fetchThemeAssets).not.toHaveBeenCalled()
    expect(themeFileSystem.files.get('templates/asset.json')).toBeUndefined()
  })

  test('does not delete local file when noDelete option is provided and file is deleted from remote', async () => {
    // Given
    const remoteChecksums = [{checksum: '1', key: 'templates/asset.json'}]
    const files = new Map<string, ThemeAsset>([['templates/asset.json', {checksum: '1', key: 'templates/asset.json'}]])
    const themeFileSystem = fakeThemeFileSystem('tmp', files)
    vi.mocked(fetchChecksums).mockResolvedValue([])

    // When
    await pollRemoteJsonChanges(developmentTheme, adminSession, remoteChecksums, themeFileSystem, {
      ...defaultOptions,
      noDelete: true,
    })

    // Then
    expect(fetchThemeAssets).not.toHaveBeenCalled()
    expect(themeFileSystem.files.get('templates/asset.json')).toEqual({checksum: '1', key: 'templates/asset.json'})
  })

  test('throws an error when there is a change on remote and local', async () => {
    // Given
    const remoteChecksums = [{checksum: '1', key: 'templates/asset.json'}]
    const updatedRemoteChecksums = [{checksum: '2', key: 'templates/asset.json'}]
    vi.mocked(fetchChecksums).mockResolvedValue(updatedRemoteChecksums)
    vi.spyOn(process, 'exit').mockResolvedValue(null as never)

    const themeFileSystem = fakeThemeFileSystem('tmp', new Map())
    themeFileSystem.read = async (fileKey: string) => {
      themeFileSystem.files.set(fileKey, {checksum: '3', key: fileKey})
      return themeFileSystem.files.get(fileKey)?.value ?? themeFileSystem.files.get(fileKey)?.attachment
    }

    // When
    // Then
    await expect(() =>
      pollRemoteJsonChanges(developmentTheme, adminSession, remoteChecksums, themeFileSystem, defaultOptions),
    ).rejects.toThrow(
      new AbortError(
        `Detected changes to the file 'templates/asset.json' on both local and remote sources. Aborting...`,
      ),
    )
  })

  test('does nothing when there is a change on local only', async () => {
    // Given
    const themeFileSystem = fakeThemeFileSystem('tmp', new Map())
    const remoteChecksums = [{checksum: '1', key: 'templates/asset.json'}]
    const updatedRemoteChecksums = [{checksum: '1', key: 'templates/asset.json'}]
    const spy = vi.spyOn(themeFileSystem, 'delete')

    vi.mocked(fetchChecksums).mockResolvedValue(updatedRemoteChecksums)

    // When
    await pollRemoteJsonChanges(developmentTheme, adminSession, remoteChecksums, themeFileSystem, defaultOptions)

    // Then
    expect(fetchThemeAssets).not.toHaveBeenCalled()
    expect(spy).not.toHaveBeenCalled()
  })

  describe('file filtering', () => {
    test('only polls for JSON assets', async () => {
      // Given
      const themeFileSystem = fakeThemeFileSystem('tmp', new Map())
      const remoteChecksums = [{checksum: '1', key: 'section/section.liquid'}]
      const updatedRemoteChecksums = [{checksum: '2', key: 'section/section.liquid'}]
      vi.mocked(fetchChecksums).mockResolvedValue(updatedRemoteChecksums)

      // When
      await pollRemoteJsonChanges(developmentTheme, adminSession, remoteChecksums, themeFileSystem, defaultOptions)

      // Then
      expect(themeFileSystem.files.get('section/section.liquid')).toBeUndefined()
    })

    test('only polls for assets that match the only option', async () => {
      // Given
      const themeFileSystem = fakeThemeFileSystem('tmp', new Map(), {filters: {only: ['templates/asset.json']}})
      const remoteChecksums = [
        {checksum: '1', key: 'templates/asset.json'},
        {checksum: '1', key: 'templates/asset2.json'},
      ]
      const updatedRemoteChecksums = [
        {checksum: '2', key: 'templates/asset.json'},
        {checksum: '2', key: 'templates/asset2.json'},
      ]
      vi.mocked(fetchThemeAssets).mockResolvedValue([{checksum: '2', key: 'templates/asset.json', value: 'content'}])
      vi.mocked(fetchChecksums).mockResolvedValue(updatedRemoteChecksums)

      // When
      await pollRemoteJsonChanges(developmentTheme, adminSession, remoteChecksums, themeFileSystem, {
        ...defaultOptions,
      })

      // Then
      expect(fetchThemeAssets).toHaveBeenCalledOnce()
      expect(fetchThemeAssets).toHaveBeenCalledWith(1, ['templates/asset.json'], adminSession)
      expect(themeFileSystem.files.get('templates/asset.json')).toEqual({
        checksum: '2',
        key: 'templates/asset.json',
        value: 'content',
      })
      expect(themeFileSystem.files.get('templates/asset2.json')).toBeUndefined()
    })

    test('ignores assets that match the ignore option', async () => {
      // Given
      const themeFileSystem = fakeThemeFileSystem('tmp', new Map(), {filters: {ignore: ['templates/asset.json']}})
      const remoteChecksums = [
        {checksum: '1', key: 'templates/asset.json'},
        {checksum: '1', key: 'templates/asset2.json'},
      ]
      const updatedRemoteChecksums = [
        {checksum: '2', key: 'templates/asset.json'},
        {checksum: '2', key: 'templates/asset2.json'},
      ]
      vi.mocked(fetchThemeAssets).mockResolvedValue([{checksum: '2', key: 'templates/asset2.json', value: 'content'}])
      vi.mocked(fetchChecksums).mockResolvedValue(updatedRemoteChecksums)

      // When
      await pollRemoteJsonChanges(developmentTheme, adminSession, remoteChecksums, themeFileSystem, {
        ...defaultOptions,
      })

      // Then
      expect(fetchThemeAssets).toHaveBeenCalledOnce()
      expect(fetchThemeAssets).toHaveBeenCalledWith(1, ['templates/asset2.json'], adminSession)
      expect(themeFileSystem.files.get('templates/asset2.json')).toEqual({
        checksum: '2',
        key: 'templates/asset2.json',
        value: 'content',
      })
    })

    test('does not pull assets that are marked for upload but have not been uploaded yet', async () => {
      // Given
      const remoteChecksums = [
        {checksum: '1', key: 'templates/asset1.json'},
        {checksum: '2', key: 'templates/asset2.json'},
        {checksum: '3', key: 'templates/asset3.json'},
      ]
      const updatedRemoteChecksums = [
        {checksum: '4', key: 'templates/asset1.json'},
        {checksum: '5', key: 'templates/asset2.json'},
        {checksum: '6', key: 'templates/asset3.json'},
      ]
      vi.mocked(fetchChecksums).mockResolvedValue(updatedRemoteChecksums)
      vi.mocked(fetchThemeAssets).mockResolvedValue([
        {
          checksum: '2',
          key: 'templates/asset2.json',
          value: 'content',
        },
      ])

      const themeFileSystem = {
        ...fakeThemeFileSystem('tmp', new Map()),
        unsyncedFileKeys: new Set(['templates/asset2.json']),
      }

      // When
      await pollRemoteJsonChanges(developmentTheme, adminSession, remoteChecksums, themeFileSystem, defaultOptions)

      // Then
      expect(fetchThemeAssets).toHaveBeenCalledWith(1, ['templates/asset1.json', 'templates/asset3.json'], adminSession)
      expect(fetchThemeAssets).not.toHaveBeenCalledWith(1, ['templates/asset2.json'], adminSession)
    })
  })

  describe('deleteRemovedAssets', () => {
    test('does not call delete when assets deleted from remote has already been deleted locally', async () => {
      // Given
      const deleteSpy = vi.fn()
      const files = new Map<string, ThemeAsset>([
        ['templates/asset.json', {checksum: '1', key: 'templates/asset.json'}],
      ])
      const localFileSystem = {
        ...fakeThemeFileSystem('tmp', files),
        delete: deleteSpy,
      }

      // When
      await deleteRemovedAssets(
        localFileSystem,
        [{checksum: '1', key: 'templates/already-deleted.json'}],
        defaultOptions,
      )

      // Then
      expect(deleteSpy).not.toHaveBeenCalled()
    })
  })
})
