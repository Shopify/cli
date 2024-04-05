import {MAX_BATCH_BYTESIZE, MAX_BATCH_FILE_COUNT, MAX_UPLOAD_RETRY_COUNT, uploadTheme} from './theme-uploader.js'
import {readThemeFilesFromDisk} from './theme-fs.js'
import {fileSize} from '@shopify/cli-kit/node/fs'
import {bulkUploadThemeAssets, deleteThemeAsset} from '@shopify/cli-kit/node/themes/api'
import {Result, Checksum, Key, ThemeAsset, ThemeFileSystem, Operation} from '@shopify/cli-kit/node/themes/types'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {AdminSession} from '@shopify/cli-kit/node/session'

vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('@shopify/cli-kit/node/fs')

vi.mock('./theme-fs.js', async (realImport) => {
  const realModule = await realImport<typeof import('./theme-fs.js')>()
  const mockModule = {readThemeFilesFromDisk: vi.fn()}

  return {...realModule, ...mockModule}
})

beforeEach(() => {
  vi.mocked(bulkUploadThemeAssets).mockImplementation(
    async (
      _id: number,
      assets: Partial<Pick<ThemeAsset, 'key' | 'value' | 'attachment'>>[],
      _session: AdminSession,
    ): Promise<Result[]> => {
      return assets.map((asset) => {
        if (asset.key === undefined) {
          throw new Error('Asset key is undefined')
        }

        return {
          key: asset.key,
          success: true,
          errors: {},
          operation: Operation.Upload,
          asset: {
            key: asset.key,
            value: asset.value,
            attachment: asset.attachment,
            checksum: 'yourChecksumHere',
          },
        }
      })
    },
  )
})

describe('theme-uploader', () => {
  const remoteTheme = {id: 1, name: '', createdAtRuntime: false, processing: false, role: ''}
  const adminSession = {token: '', storeFqdn: ''}
  const uploadOptions = {nodelete: false, path: 'tmp'}

  test("should delete files that don't exist locally from remote theme", async () => {
    // Given
    const remote = [
      {key: 'assets/keepme.liquid', checksum: '1'},
      {key: 'assets/deleteme.liquid', checksum: '2'},
    ]
    const local = {
      root: 'tmp',
      files: new Map([['assets/keepme.liquid', {key: 'assets/keepme.liquid', checksum: '1'}]]),
    } as ThemeFileSystem

    // When
    await uploadTheme(remoteTheme, adminSession, remote, local, uploadOptions)

    // Then
    expect(vi.mocked(deleteThemeAsset)).toHaveBeenCalledOnce()
    expect(vi.mocked(deleteThemeAsset)).toHaveBeenCalledWith(remoteTheme.id, 'assets/deleteme.liquid', adminSession)
  })

  test('should not delete files if nodelete is set', async () => {
    // Given
    const remote = [
      {key: 'assets/keepme.liquid', checksum: '1'},
      {key: 'assets/deleteme.liquid', checksum: '2'},
    ]
    const local = {
      root: 'tmp',
      files: new Map([['assets/keepme.liquid', {key: 'assets/keepme.liquid', checksum: '1'}]]),
    } as ThemeFileSystem

    // When
    await uploadTheme(remoteTheme, adminSession, remote, local, {...uploadOptions, nodelete: true})

    // Then
    expect(vi.mocked(deleteThemeAsset)).not.toHaveBeenCalled()
  })

  test("should upload local files that don't exist on the remote theme", async () => {
    // Given
    const remoteChecksums = [{key: 'assets/existing.liquid', checksum: '1'}]
    const themeFileSystem = {
      root: 'tmp',
      files: new Map([
        ['assets/new.liquid', {checksum: '2'}],
        ['assets/newer.liquid', {checksum: '3'}],
      ]),
    } as ThemeFileSystem

    // When
    await uploadTheme(remoteTheme, adminSession, remoteChecksums, themeFileSystem, uploadOptions)

    // Then
    expect(bulkUploadThemeAssets).toHaveBeenCalledOnce()
    expect(bulkUploadThemeAssets).toHaveBeenCalledWith(
      remoteTheme.id,
      [
        {
          key: 'assets/new.liquid',
        },
        {
          key: 'assets/newer.liquid',
        },
      ],
      adminSession,
    )
  })

  test('should upload local files that exist on the remote theme if checksums mismatch', async () => {
    // Given
    const remoteChecksums = [
      {key: 'assets/matching.liquid', checksum: '1'},
      {key: 'assets/conflicting.liquid', checksum: '2'},
    ]
    const themeFileSystem = {
      root: 'tmp',
      files: new Map([
        ['assets/matching.liquid', {checksum: '1'}],
        ['assets/conflicting.liquid', {checksum: '3'}],
      ]),
    } as ThemeFileSystem

    // When
    await uploadTheme(remoteTheme, adminSession, remoteChecksums, themeFileSystem, uploadOptions)

    // Then
    expect(bulkUploadThemeAssets).toHaveBeenCalledOnce()
    expect(bulkUploadThemeAssets).toHaveBeenCalledWith(
      remoteTheme.id,
      [
        {
          key: 'assets/conflicting.liquid',
        },
      ],
      adminSession,
    )
  })

  test('should separate files by type and upload in correct order', async () => {
    // Given
    const remoteChecksums: Checksum[] = []
    const themeFileSystem = {
      root: 'tmp',
      files: new Map([
        ['assets/liquid.liquid', {key: 'assets/liquid.liquid', checksum: '1'}],
        ['templates/index.liquid', {key: 'templates/index.liquid', checksum: '4'}],
        ['config/settings_data.json', {key: 'config/settings_data.json', checksum: '2'}],
        ['config/settings_schema.json', {key: 'config/settings_schema.json', checksum: '3'}],
        ['sections/header-group.json', {key: 'sections/header-group.json', checksum: '5'}],
        ['templates/product.json', {key: 'templates/product.json', checksum: '6'}],
        ['assets/image.png', {key: 'assets/image.png', checksum: '7'}],
        ['templates/product.context.uk.json', {key: 'templates/product.context.uk.json', checksum: '8'}],
      ]),
    } as ThemeFileSystem

    // When
    await uploadTheme(remoteTheme, adminSession, remoteChecksums, themeFileSystem, uploadOptions)

    // Then
    expect(bulkUploadThemeAssets).toHaveBeenCalledTimes(5)
    expect(bulkUploadThemeAssets).toHaveBeenNthCalledWith(
      1,
      remoteTheme.id,
      [
        {
          key: 'assets/liquid.liquid',
        },
        {
          key: 'templates/index.liquid',
        },
      ],
      adminSession,
    )
    expect(bulkUploadThemeAssets).toHaveBeenNthCalledWith(
      2,
      remoteTheme.id,
      [
        {
          key: 'sections/header-group.json',
        },
        {
          key: 'templates/product.json',
        },
      ],
      adminSession,
    )
    expect(bulkUploadThemeAssets).toHaveBeenNthCalledWith(
      3,
      remoteTheme.id,
      [
        {
          key: 'templates/product.context.uk.json',
        },
      ],
      adminSession,
    )
    expect(bulkUploadThemeAssets).toHaveBeenNthCalledWith(
      4,
      remoteTheme.id,
      [
        {
          key: 'config/settings_data.json',
        },
        {
          key: 'config/settings_schema.json',
        },
      ],
      adminSession,
    )
    expect(bulkUploadThemeAssets).toHaveBeenNthCalledWith(
      5,
      remoteTheme.id,
      [
        {
          key: 'assets/image.png',
        },
      ],
      adminSession,
    )
  })

  test('should create batches for files when bulk upload file count limit is reached', async () => {
    // Given
    const remoteChecksums: Checksum[] = []
    const files = new Map<Key, ThemeAsset>()
    for (let i = 0; i < MAX_BATCH_FILE_COUNT + 2; i++) {
      files.set(`assets/test_${i}.liquid`, {
        key: `assets/test_${i}.liquid`,
        checksum: i.toString(),
        value: `test_${i}`,
      })
    }
    const themeFileSystem = {
      root: 'tmp',
      files,
    } as ThemeFileSystem

    // When
    await uploadTheme(remoteTheme, adminSession, remoteChecksums, themeFileSystem, uploadOptions)

    // Then
    expect(bulkUploadThemeAssets).toHaveBeenCalledTimes(2)
  })

  test('should create batches for files when bulk upload request size limit is reached', async () => {
    // Given
    const remoteChecksums: Checksum[] = []
    const themeFileSystem = {
      root: 'tmp',
      files: new Map([
        ['config/settings_data.json', {key: 'config/settings_data.json', checksum: '2', value: 'settings_data'}],
        ['config/settings_schema.json', {key: 'config/settings_schema.json', checksum: '3', value: 'settings_schema'}],
      ]),
    } as ThemeFileSystem

    vi.mocked(fileSize).mockResolvedValue(MAX_BATCH_BYTESIZE)

    // When
    await uploadTheme(remoteTheme, adminSession, remoteChecksums, themeFileSystem, uploadOptions)

    // Then
    expect(bulkUploadThemeAssets).toHaveBeenCalledTimes(2)
  })

  test('should only read values for theme files that will be uploaded', async () => {
    // Given
    const remoteChecksums = [{key: 'assets/existing.liquid', checksum: '1'}]
    const themeFileSystem = {
      root: 'tmp',
      files: new Map([
        ['assets/new.liquid', {checksum: '2'}],
        ['assets/newer.liquid', {checksum: '3'}],
        ['assets/existing.liquid', {checksum: '1'}],
      ]),
    } as ThemeFileSystem

    // When
    await uploadTheme(remoteTheme, adminSession, remoteChecksums, themeFileSystem, uploadOptions)
    // Then
    expect(readThemeFilesFromDisk).toHaveBeenCalledWith(
      [
        {checksum: '2', key: 'assets/new.liquid'},
        {checksum: '3', key: 'assets/newer.liquid'},
      ],
      themeFileSystem,
    )
  })

  test('should retry failed uploads', async () => {
    // Given
    const remoteChecksums = [{key: 'assets/existing.liquid', checksum: '1'}]
    const themeFileSystem = {
      root: 'tmp',
      files: new Map([
        ['assets/new.liquid', {checksum: '2'}],
        ['assets/newer.liquid', {checksum: '3'}],
      ]),
    } as ThemeFileSystem

    vi.mocked(bulkUploadThemeAssets)
      .mockResolvedValueOnce([
        {
          key: 'assets/new.liquid',
          success: true,
          errors: {},
          operation: Operation.Upload,
          asset: {key: 'assets/new.liquid', checksum: '2'},
        },
        {
          key: 'assets/newer.liquid',
          success: false,
          errors: {},
          operation: Operation.Upload,
          asset: {key: 'assets/newer.liquid', checksum: '3'},
        },
      ])
      .mockResolvedValue([
        {
          key: 'assets/newer.liquid',
          success: false,
          errors: {},
          operation: Operation.Upload,
          asset: {key: 'assets/newer.liquid', checksum: '3'},
        },
      ])

    // When
    await uploadTheme(remoteTheme, adminSession, remoteChecksums, themeFileSystem, uploadOptions)

    // Then
    expect(bulkUploadThemeAssets).toHaveBeenCalledTimes(MAX_UPLOAD_RETRY_COUNT + 1)
    expect(bulkUploadThemeAssets).toHaveBeenNthCalledWith(
      1,
      remoteTheme.id,
      [
        {
          key: 'assets/new.liquid',
        },
        {
          key: 'assets/newer.liquid',
        },
      ],
      adminSession,
    )
    expect(bulkUploadThemeAssets).toHaveBeenNthCalledWith(
      2,
      remoteTheme.id,
      [
        {
          key: 'assets/newer.liquid',
        },
      ],
      adminSession,
    )
  })

  test('should not delete or upload files specified by the --ignore flag', async () => {
    // Given
    const remote = [
      {key: 'assets/keepme.liquid', checksum: '1'},
      {key: 'assets/ignore_delete.liquid', checksum: '2'},
    ]
    const local = {
      root: 'tmp',
      files: new Map([
        ['assets/keepme.liquid', {key: 'assets/keepme.liquid', checksum: '3'}],
        ['assets/ignore_upload.liquid', {key: 'assets/ignore_upload.liquid', checksum: '4'}],
      ]),
    } as ThemeFileSystem

    // When
    await uploadTheme(remoteTheme, adminSession, remote, local, {
      ...uploadOptions,
      ignore: ['assets/ignore_delete.liquid', 'assets/ignore_upload.liquid'],
    })

    // Then
    expect(vi.mocked(deleteThemeAsset)).not.toHaveBeenCalled()
    expect(bulkUploadThemeAssets).toHaveBeenCalledOnce()
    expect(bulkUploadThemeAssets).toHaveBeenCalledWith(
      remoteTheme.id,
      [
        {
          key: 'assets/keepme.liquid',
        },
      ],
      adminSession,
    )
  })

  test('should only delete and upload files specified by --only flag', async () => {
    // Given
    const remote = [
      {key: 'assets/keepme.liquid', checksum: '1'},
      {key: 'assets/deleteme.liquid', checksum: '2'},
    ]
    const local = {
      root: 'tmp',
      files: new Map([
        ['assets/keepme.liquid', {key: 'assets/keepme.liquid', checksum: '1'}],
        ['assets/uploadme.liquid', {key: 'assets/uploadme.liquid', checksum: '3'}],
      ]),
    } as ThemeFileSystem

    // When
    await uploadTheme(remoteTheme, adminSession, remote, local, {
      ...uploadOptions,
      only: ['assets/keepme.liquid', 'assets/deleteme.liquid', 'assets/uploadme.liquid'],
    })

    // Then
    expect(vi.mocked(deleteThemeAsset)).toHaveBeenCalledOnce()
    expect(vi.mocked(deleteThemeAsset)).toHaveBeenCalledWith(remoteTheme.id, 'assets/deleteme.liquid', adminSession)
    expect(bulkUploadThemeAssets).toHaveBeenCalledOnce()
    expect(bulkUploadThemeAssets).toHaveBeenCalledWith(
      remoteTheme.id,
      [
        {
          key: 'assets/uploadme.liquid',
        },
      ],
      adminSession,
    )
  })
})
