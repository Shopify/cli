import {uploadTheme} from './theme-uploader.js'
import {startDevServer} from './theme-environment.js'
import {DEVELOPMENT_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'
import {describe, expect, test, vi} from 'vitest'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {Checksum, ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'

vi.mock('./theme-uploader.js')

describe('startDevServer', () => {
  const developmentTheme = buildTheme({id: 1, name: 'Theme', role: DEVELOPMENT_THEME_ROLE})!
  const adminSession = {token: '', storeFqdn: ''}
  const remoteChecksums: Checksum[] = []
  const localThemeFileSystem = {
    root: 'tmp',
    files: new Map([['templates/asset.json', {checksum: '1', key: 'templates/asset.json'}]]),
  } as ThemeFileSystem
  const defaultOptions = {themeEditorSync: false}

  test('should upload the development theme to remote if themeEditorSync is false', async () => {
    // Given
    const options = defaultOptions

    // When
    await startDevServer(developmentTheme, adminSession, remoteChecksums, localThemeFileSystem, options)

    // Then
    expect(uploadTheme).toHaveBeenCalled()
  })

  test('should not upload the development theme to remote if themeEditorSync is true', async () => {
    // Given
    const options = {...defaultOptions, themeEditorSync: true}

    // When
    await startDevServer(developmentTheme, adminSession, remoteChecksums, localThemeFileSystem, options)

    // Then
    expect(uploadTheme).not.toHaveBeenCalled()
  })
})
