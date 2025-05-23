import {localCLIVersion, globalCLIVersion, isPreReleaseVersion} from './version.js'
import {inTemporaryDirectory} from '../node/fs.js'
import {captureOutput} from '../node/system.js'
import {describe, expect, test, vi} from 'vitest'
import which from 'which'

vi.mock('../node/system.js')
vi.mock('which')

describe('localCLIVersion', () => {
  test('returns the version of the local CLI', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(captureOutput).mockResolvedValueOnce(`folder@ ${tmpDir}
└── @shopify/cli@3.68.0`)

      // When
      const got = await localCLIVersion(tmpDir)

      // Then
      expect(got).toEqual('3.68.0')
    })
  })

  test('returns undefined when the dependency is not installed', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(captureOutput).mockResolvedValueOnce(`folder@ ${tmpDir}
        └── (empty)`)

      // When
      const got = await localCLIVersion(tmpDir)

      // Then
      expect(got).toBeUndefined()
    })
  })

  test('returns undefined when captureOutput throws an error', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(captureOutput).mockRejectedValueOnce(new Error('Command failed'))

      // When
      const got = await localCLIVersion(tmpDir)

      // Then
      expect(got).toBeUndefined()
    })
  })

  test('returns undefined when output does not contain version match', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(captureOutput).mockResolvedValueOnce('some other output')

      // When
      const got = await localCLIVersion(tmpDir)

      // Then
      expect(got).toBeUndefined()
    })
  })
})

describe('globalCLIVersion', () => {
  test('returns the version when a recent CLI is installed globally', async () => {
    // Given
    // TS is not detecting the return type correctly, so we need to cast it
    vi.mocked(which.sync).mockReturnValue(['path/to/shopify'] as unknown as string)
    vi.mocked(captureOutput).mockResolvedValueOnce('@shopify/cli/3.65.0')

    // When
    const got = await globalCLIVersion()

    // Then
    expect(got).toBe('3.65.0')
    expect(captureOutput).toHaveBeenCalledWith('path/to/shopify', [], {env: expect.any(Object)})
  })

  test('returns undefined when the global version is older than 3.59', async () => {
    // Given
    // TS is not detecting the return type correctly, so we need to cast it
    vi.mocked(which.sync).mockReturnValue(['path/to/shopify'] as unknown as string)
    vi.mocked(captureOutput).mockImplementationOnce(() => Promise.resolve('@shopify/cli/3.50.0'))

    // When
    const got = await globalCLIVersion()

    // Then
    expect(got).toBeUndefined()
    expect(captureOutput).toHaveBeenCalledWith('path/to/shopify', [], {env: expect.any(Object)})
  })

  test('returns undefined when the global version is not installed', async () => {
    // Given
    vi.mocked(which.sync).mockReturnValue(['node_modules/bin/shopify'] as unknown as string)

    // When
    const got = await globalCLIVersion()

    // Then
    expect(got).toBeUndefined()
    expect(captureOutput).not.toHaveBeenCalled()
  })

  test('returns undefined when captureOutput throws an error', async () => {
    // Given
    vi.mocked(which.sync).mockReturnValue(['path/to/shopify'] as unknown as string)
    vi.mocked(captureOutput).mockRejectedValueOnce(new Error('Command failed'))

    // When
    const got = await globalCLIVersion()

    // Then
    expect(got).toBeUndefined()
  })

  test('returns undefined when no shopify binaries found', async () => {
    // Given
    vi.mocked(which.sync).mockReturnValue([] as unknown as string)

    // When
    const got = await globalCLIVersion()

    // Then
    expect(got).toBeUndefined()
    expect(captureOutput).not.toHaveBeenCalled()
  })

  test('returns undefined when output does not match version pattern', async () => {
    // Given
    vi.mocked(which.sync).mockReturnValue(['path/to/shopify'] as unknown as string)
    vi.mocked(captureOutput).mockResolvedValueOnce('some other output without version')

    // When
    const got = await globalCLIVersion()

    // Then
    expect(got).toBeUndefined()
  })

  test('returns version when it is a pre-release version (even if below 3.59)', async () => {
    // Given
    vi.mocked(which.sync).mockReturnValue(['path/to/shopify'] as unknown as string)
    vi.mocked(captureOutput).mockResolvedValueOnce('@shopify/cli/0.0.0-experimental.123')

    // When
    const got = await globalCLIVersion()

    // Then
    expect(got).toBe('0.0.0-experimental.123')
  })

  test('returns undefined when version match exists but version is undefined', async () => {
    // Given
    vi.mocked(which.sync).mockReturnValue(['path/to/shopify'] as unknown as string)
    vi.mocked(captureOutput).mockResolvedValueOnce('@shopify/cli/')

    // When
    const got = await globalCLIVersion()

    // Then
    expect(got).toBeUndefined()
  })
})

describe('isPreReleaseVersion', () => {
  test('returns true when the version is a pre-release version', () => {
    expect(isPreReleaseVersion('0.0.0')).toBe(true)
  })

  test('returns false when the version is not a pre-release version', () => {
    expect(isPreReleaseVersion('3.68.0')).toBe(false)
  })

  test('returns true for version starting with 0.0.0 with suffix', () => {
    expect(isPreReleaseVersion('0.0.0-experimental.123')).toBe(true)
  })

  test('returns true for version exactly 0.0.0', () => {
    expect(isPreReleaseVersion('0.0.0')).toBe(true)
  })

  test('returns false for other versions starting with 0', () => {
    expect(isPreReleaseVersion('0.1.0')).toBe(false)
  })
})
