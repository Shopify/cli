import {PollingOptions, pollRemoteJsonChanges} from './theme-polling.js'
import {readThemeFilesFromDisk} from '../theme-fs.js'
import {fakeThemeFileSystem} from '../theme-fs/theme-fs-mock-factory.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fetchChecksums, fetchThemeAsset} from '@shopify/cli-kit/node/themes/api'
import {Checksum, ThemeFileSystem, ThemeAsset} from '@shopify/cli-kit/node/themes/types'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {DEVELOPMENT_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'

vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('../theme-fs.js')

describe('pollRemoteJsonChanges', async () => {
  const developmentTheme = buildTheme({id: 1, name: 'Theme', role: DEVELOPMENT_THEME_ROLE})!
  const adminSession = {token: '', storeFqdn: ''}
  const defaultOptions: PollingOptions = {noDelete: false, only: [], ignore: []}

  let defaultThemeFileSystem: ThemeFileSystem
  let files: Map<string, ThemeAsset>

  beforeEach(() => {
    files = new Map<string, ThemeAsset>([])
    defaultThemeFileSystem = fakeThemeFileSystem('tmp', files)
  })

  test('downloads modified files from the remote theme', async () => {
    // Given
    const remoteChecksums = [{checksum: '1', key: 'templates/asset.json'}]
    const updatedRemoteChecksums = [{checksum: '2', key: 'templates/asset.json'}]
    vi.mocked(fetchChecksums).mockResolvedValue(updatedRemoteChecksums)
    vi.mocked(fetchThemeAsset).mockResolvedValue({checksum: '2', key: 'templates/asset.json', value: 'content'})

    // When
    await pollRemoteJsonChanges(developmentTheme, adminSession, remoteChecksums, defaultThemeFileSystem, defaultOptions)

    // Then
    expect(defaultThemeFileSystem.files.get('templates/asset.json')).toEqual({
      checksum: '2',
      key: 'templates/asset.json',
      value: 'content',
    })
  })

  test('downloads newly added files from remote theme', async () => {
    // Given
    const remoteChecksums: Checksum[] = []
    const updatedRemoteChecksums = [{checksum: '1', key: 'templates/asset.json'}]
    vi.mocked(fetchChecksums).mockResolvedValue(updatedRemoteChecksums)
    vi.mocked(fetchThemeAsset).mockResolvedValue({checksum: '1', key: 'templates/asset.json', value: 'content'})

    // When
    await pollRemoteJsonChanges(developmentTheme, adminSession, remoteChecksums, defaultThemeFileSystem, defaultOptions)

    // Then
    expect(defaultThemeFileSystem.files.get('templates/asset.json')).toEqual({
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
    expect(fetchThemeAsset).not.toHaveBeenCalled()
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
    expect(fetchThemeAsset).not.toHaveBeenCalled()
    expect(themeFileSystem.files.get('templates/asset.json')).toEqual({checksum: '1', key: 'templates/asset.json'})
  })

  test('throws an error when there is a change on remote and local', async () => {
    // Given
    const remoteChecksums = [{checksum: '1', key: 'templates/asset.json'}]
    const updatedRemoteChecksums = [{checksum: '2', key: 'templates/asset.json'}]
    vi.mocked(fetchChecksums).mockResolvedValue(updatedRemoteChecksums)
    vi.spyOn(process, 'exit').mockResolvedValue(null as never)

    const localThemeFileSystem = fakeThemeFileSystem('tmp', files)
    localThemeFileSystem.read = async (assetKey: string) => {
      files.set(assetKey, {checksum: '3', key: assetKey})
      return files.get(assetKey)?.value || files.get(assetKey)?.attachment
    }

    // When
    // Then
    await expect(() =>
      pollRemoteJsonChanges(developmentTheme, adminSession, remoteChecksums, localThemeFileSystem, defaultOptions),
    ).rejects.toThrow(
      new AbortError(
        `Detected changes to the file 'templates/asset.json' on both local and remote sources. Aborting...`,
      ),
    )
  })

  test('does nothing when there is a change on local only', async () => {
    // Given
    const remoteChecksums = [{checksum: '1', key: 'templates/asset.json'}]
    const updatedRemoteChecksums = [{checksum: '1', key: 'templates/asset.json'}]
    const spy = vi.spyOn(defaultThemeFileSystem, 'delete')

    vi.mocked(fetchChecksums).mockResolvedValue(updatedRemoteChecksums)
    vi.mocked(readThemeFilesFromDisk).mockImplementation(
      async (_filesToRead: ThemeAsset[], themeFileSystem: ThemeFileSystem) => {
        themeFileSystem.files.set('templates/asset.json', {checksum: '3', key: 'templates/asset.json'})
      },
    )

    // When
    await pollRemoteJsonChanges(developmentTheme, adminSession, remoteChecksums, defaultThemeFileSystem, defaultOptions)

    // Then
    expect(fetchThemeAsset).not.toHaveBeenCalled()
    expect(spy).not.toHaveBeenCalled()
  })

  describe('file filtering', () => {
    test('only polls for JSON assets', async () => {
      // Given
      const remoteChecksums = [{checksum: '1', key: 'section/section.liquid'}]
      const updatedRemoteChecksums = [{checksum: '2', key: 'section/section.liquid'}]
      vi.mocked(fetchChecksums).mockResolvedValue(updatedRemoteChecksums)

      // When
      await pollRemoteJsonChanges(
        developmentTheme,
        adminSession,
        remoteChecksums,
        defaultThemeFileSystem,
        defaultOptions,
      )

      // Then
      expect(defaultThemeFileSystem.files.get('section/section.liquid')).toBeUndefined()
    })

    test('only polls for assets that match the only option', async () => {
      // Given
      const remoteChecksums = [
        {checksum: '1', key: 'templates/asset.json'},
        {checksum: '1', key: 'templates/asset2.json'},
      ]
      const updatedRemoteChecksums = [
        {checksum: '2', key: 'templates/asset.json'},
        {checksum: '2', key: 'templates/asset2.json'},
      ]
      vi.mocked(fetchThemeAsset).mockResolvedValue({checksum: '2', key: 'templates/asset.json', value: 'content'})
      vi.mocked(fetchChecksums).mockResolvedValue(updatedRemoteChecksums)

      // When
      await pollRemoteJsonChanges(developmentTheme, adminSession, remoteChecksums, defaultThemeFileSystem, {
        ...defaultOptions,
        only: ['templates/asset.json'],
      })

      // Then
      expect(fetchThemeAsset).toHaveBeenCalledOnce()
      expect(fetchThemeAsset).toHaveBeenCalledWith(1, 'templates/asset.json', adminSession)
      expect(defaultThemeFileSystem.files.get('templates/asset.json')).toEqual({
        checksum: '2',
        key: 'templates/asset.json',
        value: 'content',
      })
      expect(defaultThemeFileSystem.files.get('templates/asset2.json')).toBeUndefined()
    })

    test('ignores assets that match the ignore option', async () => {
      // Given
      const remoteChecksums = [
        {checksum: '1', key: 'templates/asset.json'},
        {checksum: '1', key: 'templates/asset2.json'},
      ]
      const updatedRemoteChecksums = [
        {checksum: '2', key: 'templates/asset.json'},
        {checksum: '2', key: 'templates/asset2.json'},
      ]
      vi.mocked(fetchThemeAsset).mockResolvedValue({checksum: '2', key: 'templates/asset2.json', value: 'content'})
      vi.mocked(fetchChecksums).mockResolvedValue(updatedRemoteChecksums)

      // When
      await pollRemoteJsonChanges(developmentTheme, adminSession, remoteChecksums, defaultThemeFileSystem, {
        ...defaultOptions,
        ignore: ['templates/asset.json'],
      })

      // Then
      expect(fetchThemeAsset).toHaveBeenCalledOnce()
      expect(fetchThemeAsset).toHaveBeenCalledWith(1, 'templates/asset2.json', adminSession)
      expect(defaultThemeFileSystem.files.get('templates/asset2.json')).toEqual({
        checksum: '2',
        key: 'templates/asset2.json',
        value: 'content',
      })
    })
  })
})
