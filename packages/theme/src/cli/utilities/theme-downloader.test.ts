import {downloadTheme} from './theme-downloader.js'
import {fakeThemeFileSystem} from './theme-fs/theme-fs-mock-factory.js'
import {fetchThemeAssets} from '@shopify/cli-kit/node/themes/api'
import {Checksum, ThemeAsset} from '@shopify/cli-kit/node/themes/types'
import {test, describe, expect, vi} from 'vitest'

vi.mock('./theme-fs.js')
vi.mock('@shopify/cli-kit/node/themes/api')

describe('theme-downloader', () => {
  describe('downloadTheme', () => {
    const root = 'tmp'
    const remoteTheme = {id: 1, name: '', createdAtRuntime: false, processing: false, role: ''}
    const adminSession = {token: '', storeFqdn: ''}
    const downloadOptions = {nodelete: false}

    test('deletes new local files', async () => {
      // Given
      const remote = [{key: 'assets/keepme.css', checksum: '1'}]
      const files = new Map<string, ThemeAsset>([
        ['assets/keepme.css', {key: 'assets/keepme.css', checksum: '1', value: 'content'}],
        ['assets/deleteme.css', {key: 'assets/deleteme.css', checksum: '2', value: 'content'}],
      ])
      const fileSystem = fakeThemeFileSystem(root, files)
      const spy = vi.spyOn(fileSystem, 'delete')

      // When
      await downloadTheme(remoteTheme, adminSession, remote, fileSystem, downloadOptions)

      // Then
      expect(spy).toHaveBeenCalledOnce()
      expect(spy).toHaveBeenCalledWith('assets/deleteme.css')
    })

    test('does not delete files when filters are passed', async () => {
      // Given
      const remote: Checksum[] = []
      const files = new Map<string, ThemeAsset>([
        ['assets/keepme.css', {key: 'assets/keepme.css', checksum: '1', value: 'content'}],
      ])
      const fileSystem = fakeThemeFileSystem(root, files, {
        filters: {
          only: ['templates/*'],
        },
      })
      const spy = vi.spyOn(fileSystem, 'delete')

      // When
      await downloadTheme(remoteTheme, adminSession, remote, fileSystem, downloadOptions)

      // Then
      expect(spy).not.toHaveBeenCalled()
    })

    test('does not delete files when nodelete is set', async () => {
      // Given
      const downloadOptions = {nodelete: true}
      const remote: Checksum[] = []
      const files = new Map<string, ThemeAsset>([
        ['assets/keepme.css', {key: 'assets/keepme.css', checksum: '1', value: 'content'}],
      ])
      const fileSystem = fakeThemeFileSystem(root, files)
      const spy = vi.spyOn(fileSystem, 'delete')

      // When
      await downloadTheme(remoteTheme, adminSession, remote, fileSystem, downloadOptions)

      // Then
      expect(spy).not.toHaveBeenCalled()
    })

    test('downloads missing remote files', async () => {
      // Given
      const downloadOptions = {nodelete: false, only: ['/release/'], ignore: ['release/ignoreme']}
      const fileToDownload = {key: 'release/downloadme', checksum: '1'}
      const files = new Map<string, ThemeAsset>([
        ['release/alreadyexists', {checksum: '2', value: 'content', key: 'release/alreadyexists'}],
      ])
      const fileSystem = fakeThemeFileSystem(root, files, {filters: downloadOptions})
      const remote = [
        fileToDownload,
        {key: 'release/alreadyexists', checksum: '2'},
        {key: 'ignoreme', checksum: '3'},
        {key: 'release/ignoreme', checksum: '4'},
      ]
      const spy = vi.spyOn(fileSystem, 'write')

      vi.mocked(fetchThemeAssets).mockResolvedValue([fileToDownload])

      // When
      await downloadTheme(remoteTheme, adminSession, remote, fileSystem, downloadOptions)

      // Then
      expect(spy).toHaveBeenCalledOnce()
      expect(spy).toHaveBeenCalledWith(fileToDownload)
    })
  })
})
