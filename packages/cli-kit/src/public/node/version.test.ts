import {captureOutput, exec} from './system.js'
import {localCLIVersion, globalCLIVersion, availableHomebrewCLIVersion, isPreReleaseVersion} from './version.js'
import {inTemporaryDirectory} from './fs.js'
import {afterEach, describe, expect, test, vi} from 'vitest'

import which from 'which'

vi.mock('../node/system.js')
vi.mock('which')

afterEach(() => vi.unstubAllEnvs())

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
  test('verifies the command exposed by a versioned Homebrew formula', async () => {
    vi.mocked(which.sync).mockReturnValue(['path/to/shopify4'] as unknown as string)
    vi.mocked(captureOutput).mockResolvedValue('@shopify/cli/4.10.1')

    await expect(globalCLIVersion('shopify4')).resolves.toBe('4.10.1')
    expect(which.sync).toHaveBeenCalledWith('shopify4', {all: true})
    expect(captureOutput).toHaveBeenCalledWith('path/to/shopify4', [], {env: expect.any(Object)})
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
})

describe('availableHomebrewCLIVersion', () => {
  test('refreshes formula metadata before reading the stable version', async () => {
    vi.mocked(captureOutput).mockResolvedValue(JSON.stringify({formulae: [{versions: {stable: '5.0.1'}}]}))

    await expect(availableHomebrewCLIVersion()).resolves.toBe('5.0.1')
    expect(exec).toHaveBeenCalledWith('brew', ['update', '--quiet'], {
      env: {HOMEBREW_NO_AUTO_UPDATE: '1'},
      signal: expect.any(AbortSignal),
    })
    expect(captureOutput).toHaveBeenCalledExactlyOnceWith('brew', ['info', '--json=v2', 'shopify-cli'], {
      env: {HOMEBREW_NO_AUTO_UPDATE: '1'},
    })
    expect(vi.mocked(exec).mock.invocationCallOrder[0]!).toBeLessThan(
      vi.mocked(captureOutput).mock.invocationCallOrder[0]!,
    )
  })

  test('returns undefined without reading the formula when the metadata refresh takes too long', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(AbortSignal.abort())

    await expect(availableHomebrewCLIVersion()).resolves.toBeUndefined()
    expect(timeout).toHaveBeenCalledWith(30 * 1000)
    expect(captureOutput).not.toHaveBeenCalled()
  })

  test('returns undefined without reading the formula when the metadata refresh fails', async () => {
    vi.mocked(exec).mockRejectedValue(new Error('No network'))

    await expect(availableHomebrewCLIVersion()).resolves.toBeUndefined()
    expect(captureOutput).not.toHaveBeenCalled()
  })

  test('looks up the versioned formula that installed the CLI', async () => {
    vi.stubEnv('SHOPIFY_HOMEBREW_FORMULA', 'shopify-cli@4')
    vi.mocked(captureOutput).mockResolvedValue(JSON.stringify({formulae: [{versions: {stable: '4.10.1'}}]}))

    await expect(availableHomebrewCLIVersion()).resolves.toBe('4.10.1')
    expect(captureOutput).toHaveBeenCalledWith('brew', ['info', '--json=v2', 'shopify-cli@4'], {
      env: {HOMEBREW_NO_AUTO_UPDATE: '1'},
    })
  })

  test.each([
    'invalid JSON',
    '{}',
    'null',
    JSON.stringify({formulae: []}),
    JSON.stringify({formulae: [{versions: {stable: null}}]}),
    JSON.stringify({formulae: [{versions: {stable: 'not-a-version'}}]}),
  ])('returns undefined for unusable formula metadata: %s', async (output) => {
    vi.mocked(captureOutput).mockResolvedValue(output)

    await expect(availableHomebrewCLIVersion()).resolves.toBeUndefined()
  })

  test('returns undefined when Homebrew cannot read the formula', async () => {
    vi.mocked(captureOutput).mockRejectedValue(new Error('Formula unavailable'))

    await expect(availableHomebrewCLIVersion()).resolves.toBeUndefined()
    expect(captureOutput).toHaveBeenCalledOnce()
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
