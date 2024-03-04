import {downloadTheme} from './theme-downloader.js'
import {removeThemeFile, writeThemeFile} from './theme-fs.js'
import {fetchThemeAsset} from '@shopify/cli-kit/node/themes/api'
import {Checksum, ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'
import {test, describe, expect, vi} from 'vitest'

vi.mock('./theme-fs.js')
vi.mock('@shopify/cli-kit/node/themes/api')

describe('theme-downloader', () => {
  describe('downloadTheme', () => {
    const remoteTheme = {id: 1, name: '', createdAtRuntime: false, processing: false, role: ''}
    const adminSession = {token: '', storeFqdn: ''}
    const downloadOptions = {nodelete: false}

    test('deletes new local files', async () => {
      // Given
      const remote = [{key: 'keepme', checksum: '1'}]
      const local = {
        root: 'tmp',
        files: new Map([
          ['keepme', {checksum: '1'}],
          ['deleteme', {checksum: '2'}],
        ]),
      } as ThemeFileSystem

      // When
      await downloadTheme(remoteTheme, adminSession, remote, local, downloadOptions)

      // Then
      expect(vi.mocked(removeThemeFile)).toHaveBeenCalledOnce()
      expect(vi.mocked(removeThemeFile)).toHaveBeenCalledWith('tmp', 'deleteme')
    })

    test('does not delete files when nodelete is set', async () => {
      // Given
      const downloadOptions = {nodelete: true}
      const remote: Checksum[] = []
      const local = {files: new Map([['keepme', {}]])} as ThemeFileSystem

      // When
      await downloadTheme(remoteTheme, adminSession, remote, local, downloadOptions)

      // Then
      expect(vi.mocked(removeThemeFile)).not.toHaveBeenCalled()
    })

    test('downloads missing remote files', async () => {
      // Given
      const downloadOptions = {nodelete: false, only: ['release'], ignore: ['release/ignoreme']}
      const fileToDownload = {key: 'release/downloadme', checksum: '1'}
      const local = {root: 'tmp', files: new Map([['release/alreadyexists', {checksum: '2'}]])} as ThemeFileSystem
      const remote = [
        fileToDownload,
        {key: 'release/alreadyexists', checksum: '2'},
        {key: 'ignoreme', checksum: '3'},
        {key: 'release/ignoreme', checksum: '4'},
      ]

      vi.mocked(fetchThemeAsset).mockResolvedValue(fileToDownload)

      // When
      await downloadTheme(remoteTheme, adminSession, remote, local, downloadOptions)

      // Then
      expect(vi.mocked(writeThemeFile)).toHaveBeenCalledOnce()
      expect(vi.mocked(writeThemeFile)).toHaveBeenCalledWith('tmp', fileToDownload)
    })
  })
})
