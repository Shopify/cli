import {
  MAX_BATCH_BYTESIZE,
  MAX_BATCH_FILE_COUNT,
  MAX_UPLOAD_RETRY_COUNT,
  MINIMUM_THEME_ASSETS,
  uploadTheme,
} from './theme-uploader.js'
import {fakeThemeFileSystem} from './theme-fs/theme-fs-mock-factory.js'
import {bulkUploadThemeAssets, deleteThemeAsset} from '@shopify/cli-kit/node/themes/api'
import {Result, Checksum, Key, ThemeAsset, Operation} from '@shopify/cli-kit/node/themes/types'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {AdminSession} from '@shopify/cli-kit/node/session'

vi.mock('@shopify/cli-kit/node/themes/api')

beforeEach(() => {
  vi.mocked(deleteThemeAsset).mockImplementation(() => Promise.resolve(true))

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
  const uploadOptions = {nodelete: false}

  test("should delete files that don't exist locally from remote theme", async () => {
    // Given
    const remote = [
      {key: 'assets/keepme.liquid', checksum: '1'},
      {key: 'assets/deleteme.liquid', checksum: '2'},
    ]
    const local = fakeThemeFileSystem(
      'tmp',
      new Map([['assets/keepme.liquid', {key: 'assets/keepme.liquid', checksum: '1'}]]),
    )

    // When
    const {renderThemeSyncProgress} = uploadTheme(remoteTheme, adminSession, remote, local, uploadOptions)
    await renderThemeSyncProgress()

    // Then
    expect(vi.mocked(deleteThemeAsset)).toHaveBeenCalledOnce()
    expect(vi.mocked(deleteThemeAsset)).toHaveBeenCalledWith(remoteTheme.id, 'assets/deleteme.liquid', adminSession)
  })

  test('should not delete generated assets', async () => {
    // Given
    const remote = [
      {key: 'assets/keepme.liquid', checksum: '1'},
      {key: 'assets/base.css', checksum: '2'},
      {key: 'assets/base.css.liquid', checksum: '3'},
    ]
    const local = fakeThemeFileSystem(
      'tmp',
      new Map([['assets/keepme.liquid', {key: 'assets/keepme.liquid', checksum: '1'}]]),
    )

    // When
    const {renderThemeSyncProgress} = uploadTheme(remoteTheme, adminSession, remote, local, uploadOptions)
    await renderThemeSyncProgress()

    // Then
    expect(vi.mocked(deleteThemeAsset)).toHaveBeenCalledOnce()
    expect(vi.mocked(deleteThemeAsset)).toHaveBeenCalledWith(remoteTheme.id, 'assets/base.css.liquid', adminSession)
  })

  test('should not delete files if nodelete is set', async () => {
    // Given
    const remote = [
      {key: 'assets/keepme.liquid', checksum: '1'},
      {key: 'assets/deleteme.liquid', checksum: '2'},
    ]

    const local = fakeThemeFileSystem(
      'tmp',
      new Map([['assets/keepme.liquid', {key: 'assets/keepme.liquid', checksum: '1'}]]),
    )

    // When
    const {renderThemeSyncProgress} = uploadTheme(remoteTheme, adminSession, remote, local, {
      ...uploadOptions,
      nodelete: true,
    })
    await renderThemeSyncProgress()

    // Then
    expect(vi.mocked(deleteThemeAsset)).not.toHaveBeenCalled()
  })

  test("should upload a minimum set of files if a theme doesn't exist yet", async () => {
    const [firstFile, ...rest] = MINIMUM_THEME_ASSETS
    const remoteChecksums = [{key: firstFile.key, checksum: '1'}]

    // Given
    const themeFileSystem = fakeThemeFileSystem('tmp', new Map([]))

    // When
    const {renderThemeSyncProgress} = uploadTheme(
      remoteTheme,
      adminSession,
      remoteChecksums,
      themeFileSystem,
      uploadOptions,
    )
    await renderThemeSyncProgress()

    // Then
    expect(bulkUploadThemeAssets).toHaveBeenCalledTimes(1)
    expect(bulkUploadThemeAssets).toHaveBeenCalledWith(remoteTheme.id, rest, adminSession)
  })

  test('should skip theme creation if files already exist in remote', async () => {
    const remoteChecksums = MINIMUM_THEME_ASSETS.map((item) => ({key: item.key, checksum: '1'}))

    // Given
    const themeFileSystem = fakeThemeFileSystem('tmp', new Map([]))

    // When
    const {renderThemeSyncProgress} = uploadTheme(
      remoteTheme,
      adminSession,
      remoteChecksums,
      themeFileSystem,
      uploadOptions,
    )
    await renderThemeSyncProgress()

    // Then
    expect(bulkUploadThemeAssets).not.toHaveBeenCalled()
  })

  test("should upload a minimum set of files if a them doesn't exist yet", async () => {
    // Given
    const themeFileSystem = fakeThemeFileSystem('tmp', new Map([]))

    // When
    const {renderThemeSyncProgress} = uploadTheme(remoteTheme, adminSession, [], themeFileSystem, uploadOptions)
    await renderThemeSyncProgress()

    // Then
    expect(bulkUploadThemeAssets).toHaveBeenCalledTimes(1)
    expect(bulkUploadThemeAssets).toHaveBeenCalledWith(remoteTheme.id, MINIMUM_THEME_ASSETS, adminSession)
  })

  test("should upload local files that don't exist on the remote theme", async () => {
    // Given
    const remoteChecksums = [{key: 'assets/existing.liquid', checksum: '1'}]
    const themeFileSystem = fakeThemeFileSystem(
      'tmp',
      new Map([
        ['assets/new.liquid', {checksum: '2', key: ''}],
        ['assets/newer.liquid', {checksum: '3', key: ''}],
      ]),
    )

    // When
    const {renderThemeSyncProgress} = uploadTheme(
      remoteTheme,
      adminSession,
      remoteChecksums,
      themeFileSystem,
      uploadOptions,
    )
    await renderThemeSyncProgress()

    // Then
    expect(bulkUploadThemeAssets).toHaveBeenCalledTimes(2)
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
    const themeFileSystem = fakeThemeFileSystem(
      'tmp',
      new Map([
        ['assets/matching.liquid', {checksum: '1', key: ''}],
        ['assets/conflicting.liquid', {checksum: '3', key: ''}],
      ]),
    )

    // When
    const {renderThemeSyncProgress} = uploadTheme(
      remoteTheme,
      adminSession,
      remoteChecksums,
      themeFileSystem,
      uploadOptions,
    )
    await renderThemeSyncProgress()

    // Then
    expect(bulkUploadThemeAssets).toHaveBeenCalledTimes(2)
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

  test('should delete files in correct order', async () => {
    // Given
    const remoteChecksums: Checksum[] = [
      {key: 'templates/product.context.uk.json', checksum: '1'},
      {key: 'templates/product.json', checksum: '2'},
      {key: 'sections/header-group.json', checksum: '3'},
      {key: 'templates/index.liquid', checksum: '4'},
      {key: 'assets/liquid.liquid', checksum: '5'},
      {key: 'config/settings_data.json', checksum: '6'},
      {key: 'assets/image.png', checksum: '7'},
    ]
    const themeFileSystem = fakeThemeFileSystem('tmp', new Map([]))

    // When
    const {renderThemeSyncProgress} = uploadTheme(
      remoteTheme,
      adminSession,
      remoteChecksums,
      themeFileSystem,
      uploadOptions,
    )
    await renderThemeSyncProgress()

    // Then
    expect(deleteThemeAsset).toHaveBeenCalledTimes(7)
    expect(deleteThemeAsset).toHaveBeenNthCalledWith(
      1,
      remoteTheme.id,
      'templates/product.context.uk.json',
      adminSession,
    )
    expect(deleteThemeAsset).toHaveBeenNthCalledWith(2, remoteTheme.id, 'templates/product.json', adminSession)
    expect(deleteThemeAsset).toHaveBeenNthCalledWith(3, remoteTheme.id, 'sections/header-group.json', adminSession)
    expect(deleteThemeAsset).toHaveBeenNthCalledWith(4, remoteTheme.id, 'templates/index.liquid', adminSession)
    expect(deleteThemeAsset).toHaveBeenNthCalledWith(5, remoteTheme.id, 'assets/liquid.liquid', adminSession)
    expect(deleteThemeAsset).toHaveBeenNthCalledWith(6, remoteTheme.id, 'config/settings_data.json', adminSession)
    expect(deleteThemeAsset).toHaveBeenNthCalledWith(7, remoteTheme.id, 'assets/image.png', adminSession)
  })

  test('should separate files by type and upload in correct order', async () => {
    // Given
    const remoteChecksums: Checksum[] = []
    const themeFileSystem = fakeThemeFileSystem(
      'tmp',
      new Map([
        ['assets/liquid.liquid', {key: 'assets/liquid.liquid', checksum: '1'}],
        ['templates/index.liquid', {key: 'templates/index.liquid', checksum: '4'}],
        ['sections/header.liquid', {key: 'sections/header.liquid', checksum: '9'}],
        ['config/settings_data.json', {key: 'config/settings_data.json', checksum: '2'}],
        ['config/settings_schema.json', {key: 'config/settings_schema.json', checksum: '3'}],
        ['sections/header-group.json', {key: 'sections/header-group.json', checksum: '5'}],
        ['templates/product.json', {key: 'templates/product.json', checksum: '6'}],
        ['assets/image.png', {key: 'assets/image.png', checksum: '7'}],
        ['templates/product.context.uk.json', {key: 'templates/product.context.uk.json', checksum: '8'}],
      ]),
    )

    // When
    const {renderThemeSyncProgress} = uploadTheme(
      remoteTheme,
      adminSession,
      remoteChecksums,
      themeFileSystem,
      uploadOptions,
    )
    await renderThemeSyncProgress()

    // Then
    expect(bulkUploadThemeAssets).toHaveBeenCalledTimes(7)
    // Mininum theme files start first
    expect(bulkUploadThemeAssets).toHaveBeenNthCalledWith(1, remoteTheme.id, MINIMUM_THEME_ASSETS, adminSession)
    // Dependent assets start second
    expect(bulkUploadThemeAssets).toHaveBeenNthCalledWith(
      2,
      remoteTheme.id,
      [
        {
          key: 'sections/header.liquid',
        },
      ],
      adminSession,
    )
    // Independent assets start right before dependent assets start
    expect(bulkUploadThemeAssets).toHaveBeenNthCalledWith(
      3,
      remoteTheme.id,
      [
        {
          key: 'assets/liquid.liquid',
        },
        {
          key: 'templates/index.liquid',
        },
        {
          key: 'assets/image.png',
        },
      ],
      adminSession,
    )
    // Dependent assets continue after the first batch of dependent assets ends
    expect(bulkUploadThemeAssets).toHaveBeenNthCalledWith(
      4,
      remoteTheme.id,
      [
        {
          key: 'sections/header-group.json',
        },
      ],
      adminSession,
    )
    expect(bulkUploadThemeAssets).toHaveBeenNthCalledWith(
      5,
      remoteTheme.id,
      [
        {
          key: 'templates/product.json',
        },
      ],
      adminSession,
    )
    expect(bulkUploadThemeAssets).toHaveBeenNthCalledWith(
      6,
      remoteTheme.id,
      [
        {
          key: 'templates/product.context.uk.json',
        },
      ],
      adminSession,
    )
    expect(bulkUploadThemeAssets).toHaveBeenNthCalledWith(
      7,
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
    const themeFileSystem = fakeThemeFileSystem('tmp', files)

    // When
    const {renderThemeSyncProgress} = uploadTheme(
      remoteTheme,
      adminSession,
      remoteChecksums,
      themeFileSystem,
      uploadOptions,
    )
    await renderThemeSyncProgress()

    // Then
    expect(bulkUploadThemeAssets).toHaveBeenCalledTimes(3)
  })

  test('should create batches for files when bulk upload request size limit is reached', async () => {
    // Given
    const remoteChecksums: Checksum[] = []
    const themeFileSystem = fakeThemeFileSystem(
      'tmp',
      new Map([
        [
          'config/settings_data.json',
          {
            key: 'config/settings_data.json',
            checksum: '2',
            value: 'some_settings_data',
            stats: {size: MAX_BATCH_BYTESIZE, mtime: 0},
          },
        ],
        ['config/settings_schema.json', {key: 'config/settings_schema.json', checksum: '3', value: 'settings_schema'}],
      ]),
    )

    // When
    const {renderThemeSyncProgress} = uploadTheme(
      remoteTheme,
      adminSession,
      remoteChecksums,
      themeFileSystem,
      uploadOptions,
    )
    await renderThemeSyncProgress()

    // Then
    expect(bulkUploadThemeAssets).toHaveBeenCalledTimes(3)
  })

  test('should retry failed uploads', async () => {
    // Given
    const remoteChecksums = [{key: 'assets/existing.liquid', checksum: '1'}]
    const themeFileSystem = fakeThemeFileSystem(
      'tmp',
      new Map([
        ['assets/new.liquid', {checksum: '2', key: ''}],
        ['assets/newer.liquid', {checksum: '3', key: ''}],
      ]),
    )

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
    const {renderThemeSyncProgress} = uploadTheme(
      remoteTheme,
      adminSession,
      remoteChecksums,
      themeFileSystem,
      uploadOptions,
    )
    await renderThemeSyncProgress()

    // Then
    expect(bulkUploadThemeAssets).toHaveBeenCalledTimes(MAX_UPLOAD_RETRY_COUNT + 2)
    expect(bulkUploadThemeAssets).toHaveBeenNthCalledWith(1, remoteTheme.id, MINIMUM_THEME_ASSETS, adminSession)
    expect(bulkUploadThemeAssets).toHaveBeenNthCalledWith(
      2,
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
      3,
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
    const local = fakeThemeFileSystem(
      'tmp',
      new Map([
        ['assets/keepme.liquid', {key: 'assets/keepme.liquid', checksum: '3'}],
        ['assets/ignore_upload.liquid', {key: 'assets/ignore_upload.liquid', checksum: '4'}],
      ]),
      {
        filters: {
          ignore: ['assets/ignore_delete.liquid', 'assets/ignore_upload.liquid'],
        },
      },
    )

    // When
    const {renderThemeSyncProgress} = uploadTheme(remoteTheme, adminSession, remote, local, uploadOptions)
    await renderThemeSyncProgress()

    // Then
    expect(vi.mocked(deleteThemeAsset)).not.toHaveBeenCalled()
    expect(bulkUploadThemeAssets).toHaveBeenCalledTimes(2)
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
    const localTheme = fakeThemeFileSystem(
      'tmp',
      new Map([
        ['assets/keepme.liquid', {key: 'assets/keepme.liquid', checksum: '1'}],
        ['assets/uploadme.liquid', {key: 'assets/uploadme.liquid', checksum: '3'}],
      ]),
      {filters: {only: ['assets/keepme.liquid', 'assets/deleteme.liquid', 'assets/uploadme.liquid']}},
    )

    // When
    const {renderThemeSyncProgress} = uploadTheme(remoteTheme, adminSession, remote, localTheme, uploadOptions)
    await renderThemeSyncProgress()

    // Then
    expect(vi.mocked(deleteThemeAsset)).toHaveBeenCalledOnce()
    expect(vi.mocked(deleteThemeAsset)).toHaveBeenCalledWith(remoteTheme.id, 'assets/deleteme.liquid', adminSession)
    expect(bulkUploadThemeAssets).toHaveBeenCalledTimes(2)
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
