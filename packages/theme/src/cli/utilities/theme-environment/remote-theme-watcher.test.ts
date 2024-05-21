import {reconcileJsonFiles} from './theme-reconciliation.js'
import {reconcileAndPollThemeEditorChanges} from './remote-theme-watcher.js'
import {pollThemeEditorChanges} from './theme-polling.js'
import {fakeThemeFileSystem} from '../theme-fs/theme-fs-mock-factory.js'
import {mountThemeFileSystem} from '../theme-fs.js'
import {fetchChecksums} from '@shopify/cli-kit/node/themes/api'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {ThemeAsset} from '@shopify/cli-kit/node/themes/types'
import {DEVELOPMENT_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'
import {describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('./theme-reconciliation.js')
vi.mock('./theme-polling.js')
vi.mock('../theme-fs.js')

describe('reconcileAndPollThemeEditorChanges', async () => {
  const developmentTheme = buildTheme({id: 1, name: 'Theme', role: DEVELOPMENT_THEME_ROLE})!
  const adminSession = {token: '', storeFqdn: ''}

  test('should call pollThemeEditorChanges with updated checksums if the remote theme was been updated during reconciliation', async () => {
    // Given
    const files = new Map<string, ThemeAsset>([])
    const defaultThemeFileSystem = fakeThemeFileSystem('tmp', files)
    const initialRemoteChecksums = [{checksum: '1', key: 'templates/asset.json'}]
    const newFileSystem = fakeThemeFileSystem('tmp', new Map<string, ThemeAsset>([]))

    vi.mocked(reconcileJsonFiles).mockResolvedValue(undefined)
    vi.mocked(fetchChecksums).mockResolvedValue([{checksum: '2', key: 'templates/asset.json'}])
    vi.mocked(mountThemeFileSystem).mockResolvedValue(newFileSystem)

    // When
    await reconcileAndPollThemeEditorChanges(
      developmentTheme,
      adminSession,
      initialRemoteChecksums,
      defaultThemeFileSystem,
      {
        noDelete: false,
      },
    )

    // Then
    expect(pollThemeEditorChanges).toHaveBeenCalledWith(
      developmentTheme,
      adminSession,
      [{checksum: '2', key: 'templates/asset.json'}],
      newFileSystem,
      {
        noDelete: false,
      },
    )
  })
})
