import {captureOutput} from './system.js'
import {localCLIVersion, globalCLIVersion, isPreReleaseVersion, _resetGlobalCLIVersionCache} from './version.js'
import {inTemporaryDirectory} from './fs.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'

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
})

describe('globalCLIVersion', () => {
  beforeEach(() => {
    _resetGlobalCLIVersionCache()
  })

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

  test('memoizes the result', async () => {
    // Given
    vi.mocked(which.sync).mockReturnValue(['path/to/shopify'] as unknown as string)
    vi.mocked(captureOutput).mockResolvedValue('@shopify/cli/3.65.0')

    // When
    const got1 = await globalCLIVersion()
    const got2 = await globalCLIVersion()

    // Then
    expect(got1).toBe('3.65.0')
    expect(got2).toBe('3.65.0')
    expect(captureOutput).toHaveBeenCalledTimes(1)
  })

  test('resets the cache when _resetGlobalCLIVersionCache is called', async () => {
    // Given
    vi.mocked(which.sync).mockReturnValue(['path/to/shopify'] as unknown as string)
    vi.mocked(captureOutput).mockResolvedValue('@shopify/cli/3.65.0')

    // When
    await globalCLIVersion()
    _resetGlobalCLIVersionCache()
    await globalCLIVersion()

    // Then
    expect(captureOutput).toHaveBeenCalledTimes(2)
  })
})

describe('isPreReleaseVersion', () => {
  test('returns true when the version is a pre-release version', () => {
    expect(isPreReleaseVersion('0.0.0')).toBe(true)
  })

  test('returns false when the version is not a pre-release version', () => {
    expect(isPreReleaseVersion('3.68.0')).toBe(false)
  })
})
