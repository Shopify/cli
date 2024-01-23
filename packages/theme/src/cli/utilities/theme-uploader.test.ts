import {MAX_BATCH_BYTESIZE, MAX_BATCH_FILE_COUNT, MAX_UPLOAD_RETRY_COUNT, uploadTheme} from './theme-uploader.js'
import {readThemeFile} from './theme-fs.js'
import {fileSize} from '@shopify/cli-kit/node/fs'
import {bulkUploadThemeAssets, deleteThemeAsset} from '@shopify/cli-kit/node/themes/api'
import {BulkUploadResult, Checksum, Key, ThemeAsset, ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {AdminSession} from '@shopify/cli-kit/node/session'

vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('@shopify/cli-kit/node/fs')

vi.mock('./theme-fs.js', async (realImport) => {
  const realModule = await realImport<typeof import('./theme-fs.js')>()
  const mockModule = {readThemeFile: vi.fn()}

  return {...realModule, ...mockModule}
})

beforeEach(() => {
  vi.mocked(readThemeFile).mockImplementation(async (_root, path) => {
    return path
  })
  vi.mocked(bulkUploadThemeAssets).mockImplementation(
    async (
      _id: number,
      assets: Partial<Pick<ThemeAsset, 'key' | 'value' | 'attachment'>>[],
      _session: AdminSession,
    ): Promise<BulkUploadResult[]> => {
      return assets.map((asset) => {
        if (asset.key === undefined) {
          throw new Error('Asset key is undefined')
        }

        return {
          key: asset.key,
          success: true,
          errors: {},
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
          value: 'assets/new.liquid',
        },
        {
          key: 'assets/newer.liquid',
          value: 'assets/newer.liquid',
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
        ['assets/matching.liquid', {checksum: '1', value: 'fizzbuzz'}],
        ['assets/conflicting.liquid', {checksum: '3', value: 'buzzbazz'}],
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
          value: 'assets/conflicting.liquid',
        },
      ],
      adminSession,
    )
  })

  test('should separate files by type', async () => {
    // Given
    const remoteChecksums: Checksum[] = []
    const themeFileSystem = {
      root: 'tmp',
      files: new Map([
        ['assets/liquid.liquid', {key: 'assets/liquid.liquid', checksum: '1', value: 'liquid'}],
        ['templates/index.liquid', {key: 'templates/index.liquid', checksum: '4', value: 'index'}],
        ['config/settings_data.json', {key: 'config/settings_data.json', checksum: '2', value: 'settings_data'}],
        ['config/settings_schema.json', {key: 'config/settings_schema.json', checksum: '3', value: 'settings_schema'}],
        ['sections/header-group.json', {key: 'sections/header-group.json', checksum: '5', value: 'header-group'}],
        ['templates/product.json', {key: 'templates/product.json', checksum: '6', value: 'product'}],
        ['assets/image.png', {key: 'assets/image.png', checksum: '7', value: 'image'}],
      ]),
    } as ThemeFileSystem
    const options = {path: 'tmp'}

    // When
    await uploadTheme(remoteTheme, adminSession, remoteChecksums, themeFileSystem, options)

    // Then
    expect(bulkUploadThemeAssets).toHaveBeenCalledTimes(4)
    expect(bulkUploadThemeAssets).toHaveBeenCalledWith(
      remoteTheme.id,
      [
        {
          key: 'assets/liquid.liquid',
          value: 'assets/liquid.liquid',
        },
        {
          key: 'templates/index.liquid',
          value: 'templates/index.liquid',
        },
      ],
      adminSession,
    )
    expect(bulkUploadThemeAssets).toHaveBeenCalledWith(
      remoteTheme.id,
      [
        {
          key: 'config/settings_data.json',
          value: 'config/settings_data.json',
        },
        {
          key: 'config/settings_schema.json',
          value: 'config/settings_schema.json',
        },
      ],
      adminSession,
    )
    expect(bulkUploadThemeAssets).toHaveBeenCalledWith(
      remoteTheme.id,
      [
        {
          key: 'assets/image.png',
          value: 'assets/image.png',
        },
      ],
      adminSession,
    )
    expect(bulkUploadThemeAssets).toHaveBeenCalledWith(
      remoteTheme.id,
      [
        {
          key: 'sections/header-group.json',
          value: 'sections/header-group.json',
        },
        {
          key: 'templates/product.json',
          value: 'templates/product.json',
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
    const options = {path: 'tmp'}

    vi.mocked(fileSize).mockResolvedValue(MAX_BATCH_BYTESIZE)

    // When
    await uploadTheme(remoteTheme, adminSession, remoteChecksums, themeFileSystem, options)

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
    expect(readThemeFile).toHaveBeenCalledTimes(2)
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
    const options = {path: 'tmp'}

    vi.mocked(bulkUploadThemeAssets)
      .mockResolvedValueOnce([
        {
          key: 'assets/new.liquid',
          success: true,
          errors: {},
          asset: {key: 'assets/new.liquid', checksum: '2'},
        },
        {
          key: 'assets/newer.liquid',
          success: false,
          errors: {},
          asset: {key: 'assets/newer.liquid', checksum: '3'},
        },
      ])
      .mockResolvedValue([
        {
          key: 'assets/newer.liquid',
          success: false,
          errors: {},
          asset: {key: 'assets/newer.liquid', checksum: '3'},
        },
      ])

    // When
    await uploadTheme(remoteTheme, adminSession, remoteChecksums, themeFileSystem, options)

    // Then
    expect(bulkUploadThemeAssets).toHaveBeenCalledTimes(MAX_UPLOAD_RETRY_COUNT + 1)
    expect(bulkUploadThemeAssets).toHaveBeenNthCalledWith(
      1,
      remoteTheme.id,
      [
        {
          key: 'assets/new.liquid',
          value: 'assets/new.liquid',
        },
        {
          key: 'assets/newer.liquid',
          value: 'assets/newer.liquid',
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
          value: 'assets/newer.liquid',
        },
      ],
      adminSession,
    )
  })

  // should base64 encode gifs
  test('should include gifs as a base64 encoded attachment', async () => {
    // Given
    const remoteChecksums: Checksum[] = []
    const themeFileSystem = {
      root: 'tmp',
      files: new Map([['assets/new.gif', {checksum: '1'}]]),
    } as ThemeFileSystem
    const options = {path: 'tmp'}
    vi.mocked(readThemeFile).mockImplementation(async (_root, _path): Promise<Buffer> => {
      return Buffer.from('adsf')
    })

    // When
    await uploadTheme(remoteTheme, adminSession, remoteChecksums, themeFileSystem, options)

    // Then
    expect(bulkUploadThemeAssets).toHaveBeenCalledTimes(1)
    expect(bulkUploadThemeAssets).toHaveBeenCalledWith(
      remoteTheme.id,
      [
        {
          key: 'assets/new.gif',
          attachment: Buffer.from('adsf').toString('base64'),
          value: undefined,
        },
      ],
      adminSession,
    )
  })
})
