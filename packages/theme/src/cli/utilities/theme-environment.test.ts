import {uploadTheme} from './theme-uploader.js'
import {DevServerContext, startDevServer} from './theme-environment.js'
import {initializeThemeEditorSync} from './asset-file-syncer.js'
import {DEVELOPMENT_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'
import {describe, expect, test, vi} from 'vitest'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'

vi.mock('./asset-file-syncer.js')
vi.mock('./theme-uploader.js')

describe('startDevServer', () => {
  const developmentTheme = buildTheme({id: 1, name: 'Theme', role: DEVELOPMENT_THEME_ROLE})!
  const localThemeFileSystem = {
    root: 'tmp',
    files: new Map([['templates/asset.json', {checksum: '1', key: 'templates/asset.json'}]]),
  } as ThemeFileSystem
  const defaultServerContext: DevServerContext = {
    session: {storefrontToken: '', token: '', storeFqdn: ''},
    remoteChecksums: [],
    localThemeFileSystem,
    themeEditorSync: false,
  }

  test('should upload the development theme to remote if themeEditorSync is false', async () => {
    // Given
    const context = defaultServerContext

    // When
    await startDevServer(developmentTheme, context, () => {})

    // Then
    expect(uploadTheme).toHaveBeenCalled()
  })

  test('should initialize theme editor sync if themeEditorSync flag is passed', async () => {
    // Given
    const context = {...defaultServerContext, themeEditorSync: true}

    // When
    await startDevServer(developmentTheme, context, () => {})

    // Then
    expect(initializeThemeEditorSync).toHaveBeenCalled()
    expect(uploadTheme).not.toHaveBeenCalled()
  })
})
