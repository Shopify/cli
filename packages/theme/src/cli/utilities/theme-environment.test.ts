import {DevelopmentThemeManager} from './development-theme-manager.js'
import {uploadTheme} from './theme-uploader.js'
import {THEME_DOWNLOAD_INTERVAL, dev} from './theme-environment.js'
import {downloadTheme} from './theme-downloader.js'
import {DEVELOPMENT_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'
import {describe, expect, test, vi} from 'vitest'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {fetchChecksums} from '@shopify/cli-kit/node/themes/api'
import {Checksum, ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'

vi.mock('./development-theme-manager.js')
vi.mock('./theme-uploader.js')
vi.mock('./theme-downloader.js')
vi.mock('@shopify/cli-kit/node/themes/api')
vi.useFakeTimers()

describe('theme-environment', () => {
  const developmentTheme = buildTheme({id: 1, name: 'Theme', role: DEVELOPMENT_THEME_ROLE})!
  const adminSession = {token: '', storeFqdn: ''}
  const remoteChecksums: Checksum[] = []
  const localThemeFileSystem = {
    root: 'tmp',
    files: new Map([['templates/asset.json', {checksum: '1', key: 'templates/asset.json'}]]),
  } as ThemeFileSystem
  const defaultOptions = {themeEditorSync: false}

  test('should upload the development theme to remote', async () => {
    // Given
    vi.mocked(DevelopmentThemeManager.prototype.findOrCreate).mockResolvedValue(developmentTheme)
    vi.mocked(fetchChecksums).mockResolvedValue([])

    // When
    await dev(developmentTheme, adminSession, remoteChecksums, localThemeFileSystem, defaultOptions)

    // Then
    expect(uploadTheme).toHaveBeenCalled()
  })

  test('should download JSON assets from remote when themeEditorSync is enabled', async () => {
    // Given
    vi.mocked(DevelopmentThemeManager.prototype.findOrCreate).mockResolvedValue(developmentTheme)
    vi.mocked(fetchChecksums).mockResolvedValue([])

    // When
    await dev(developmentTheme, adminSession, remoteChecksums, localThemeFileSystem, {
      ...defaultOptions,
      themeEditorSync: true,
    })
    vi.advanceTimersByTime(THEME_DOWNLOAD_INTERVAL)

    // Then
    expect(downloadTheme).toHaveBeenCalled()
  })
})
