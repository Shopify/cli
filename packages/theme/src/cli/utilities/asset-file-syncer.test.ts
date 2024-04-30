import {LOCAL_STRATEGY, REMOTE_STRATEGY, initializeThemeEditorSync} from './asset-file-syncer.js'
import {downloadTheme} from './theme-downloader.js'
import {uploadTheme} from './theme-uploader.js'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {Checksum, ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'
import {DEVELOPMENT_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'
import {renderSelectPrompt} from '@shopify/cli-kit/node/ui'
import {describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('./theme-downloader.js')
vi.mock('./theme-uploader.js')

describe('initializeThemeEditorSync', () => {
  const developmentTheme = buildTheme({id: 1, name: 'Theme', role: DEVELOPMENT_THEME_ROLE})!
  const adminSession = {token: '', storeFqdn: ''}
  const remoteChecksums: Checksum[] = []
  const localThemeFileSystem = {
    root: 'tmp',
    files: new Map([['templates/asset.json', {checksum: '1', key: 'templates/asset.json'}]]),
  } as ThemeFileSystem

  test('should download the development theme from remote if themeEditorSync flag is passed and `remote` source is selected', async () => {
    // Given
    vi.mocked(renderSelectPrompt).mockResolvedValue(REMOTE_STRATEGY)

    // When
    await initializeThemeEditorSync(developmentTheme, adminSession, remoteChecksums, localThemeFileSystem)

    // Then
    expect(downloadTheme).toHaveBeenCalled()
    expect(uploadTheme).not.toHaveBeenCalled()
  })

  test('should upload the local theme to remote if themeEditorSync flag is passed and `local` source is selected', async () => {
    // Given
    vi.mocked(renderSelectPrompt).mockResolvedValue(LOCAL_STRATEGY)

    // When
    await initializeThemeEditorSync(developmentTheme, adminSession, remoteChecksums, localThemeFileSystem)

    // Then
    expect(uploadTheme).toHaveBeenCalled()
    expect(downloadTheme).not.toHaveBeenCalled()
  })

  // should not call upload
})
