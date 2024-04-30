import {DevelopmentThemeManager} from './development-theme-manager.js'
import {uploadTheme} from './theme-uploader.js'
import {dev} from './theme-environment.js'
import {DEVELOPMENT_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'
import {describe, expect, test, vi} from 'vitest'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {fetchChecksums} from '@shopify/cli-kit/node/themes/api'
import {Checksum, ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'

vi.mock('./development-theme-manager.js')
vi.mock('./theme-uploader.js')
vi.mock('@shopify/cli-kit/node/themes/api')

describe('theme-environment', () => {
  const developmentTheme = buildTheme({id: 1, name: 'Theme', role: DEVELOPMENT_THEME_ROLE})!
  const adminSession = {token: '', storeFqdn: ''}
  const remoteChecksums: Checksum[] = []
  const localThemeFileSystem = {
    root: 'tmp',
    files: new Map([['templates/asset.json', {checksum: '1', key: 'templates/asset.json'}]]),
  } as ThemeFileSystem

  test('should upload the development theme to remote', async () => {
    // Given
    vi.mocked(DevelopmentThemeManager.prototype.findOrCreate).mockResolvedValue(developmentTheme)
    vi.mocked(fetchChecksums).mockResolvedValue([])

    // When
    await dev(developmentTheme, adminSession, remoteChecksums, localThemeFileSystem)

    // Then
    expect(uploadTheme).toHaveBeenCalled()
  })
})
