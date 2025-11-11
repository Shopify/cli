import {reconcileJsonFiles} from './theme-reconciliation.js'
import {reconcileAndPollThemeEditorChanges} from './remote-theme-watcher.js'
import {pollThemeEditorChanges} from './theme-polling.js'
import {fakeThemeFileSystem} from '../theme-fs/theme-fs-mock-factory.js'
import {fetchChecksums} from '@shopify/cli-kit/node/themes/api'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {ThemeAsset} from '@shopify/cli-kit/node/themes/types'
import {DEVELOPMENT_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('./theme-reconciliation.js')
vi.mock('./theme-polling.js')
vi.mock('../theme-fs.js')

describe('reconcileAndPollThemeEditorChanges', async () => {
  const developmentTheme = buildTheme({id: 1, name: 'Theme', role: DEVELOPMENT_THEME_ROLE})!
  const adminSession = {token: '', storeFqdn: ''}

  beforeEach(() => {
    vi.mocked(reconcileJsonFiles).mockResolvedValue({
      workPromise: Promise.resolve(),
    })
  })

  test('should call pollThemeEditorChanges with updated checksums if the remote theme was been updated during reconciliation', async () => {
    // Given
    const files = new Map<string, ThemeAsset>([])
    const defaultThemeFileSystem = fakeThemeFileSystem('tmp', files)
    const initialRemoteChecksums = [{checksum: '1', key: 'templates/asset.json'}]
    const mockRejectBackgroundJob = vi.fn()

    vi.mocked(fetchChecksums).mockResolvedValue([{checksum: '2', key: 'templates/asset.json'}])

    // When
    const {workPromise, updatedRemoteChecksumsPromise} = await reconcileAndPollThemeEditorChanges(
      developmentTheme,
      adminSession,
      initialRemoteChecksums,
      defaultThemeFileSystem,
      {
        noDelete: false,
        ignore: [],
        only: [],
      },
      mockRejectBackgroundJob,
    )
    await workPromise
    await updatedRemoteChecksumsPromise

    // Then
    expect(pollThemeEditorChanges).toHaveBeenCalledWith(
      developmentTheme,
      adminSession,
      [{checksum: '2', key: 'templates/asset.json'}],
      defaultThemeFileSystem,
      {
        noDelete: false,
        ignore: [],
        only: [],
      },
      mockRejectBackgroundJob,
    )
  })

  test('should wait for the local theme file system to be ready before reconciling', async () => {
    // Given
    const files = new Map<string, ThemeAsset>([])
    const defaultThemeFileSystem = fakeThemeFileSystem('tmp', files)
    const initialRemoteChecksums = [{checksum: '1', key: 'templates/asset.json'}]
    const mockRejectBackgroundJob = vi.fn()
    const options = {
      noDelete: false,
      ignore: [],
      only: [],
    }

    const readySpy = vi.spyOn(defaultThemeFileSystem, 'ready').mockImplementation(async () => {
      options.noDelete = true
      return Promise.resolve()
    })

    // When
    await reconcileAndPollThemeEditorChanges(
      developmentTheme,
      adminSession,
      initialRemoteChecksums,
      defaultThemeFileSystem,
      options,
      mockRejectBackgroundJob,
    )

    // Then
    expect(reconcileJsonFiles).toHaveBeenCalledWith(
      developmentTheme,
      adminSession,
      initialRemoteChecksums,
      defaultThemeFileSystem,
      {
        ...options,
        noDelete: true,
      },
    )
    readySpy.mockRestore()
  })
})
