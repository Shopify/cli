import {captureOutput} from './system.js'
import {localCLIVersion, globalCLIVersion, availableHomebrewCLIVersion, isPreReleaseVersion} from './version.js'
import {inTemporaryDirectory} from './fs.js'
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
})

describe('availableHomebrewCLIVersion', () => {
  test('reads the stable formula version without updating Homebrew', async () => {
    vi.mocked(captureOutput).mockResolvedValue(JSON.stringify({formulae: [{versions: {stable: '5.0.1'}}]}))

    await expect(availableHomebrewCLIVersion()).resolves.toBe('5.0.1')
    expect(captureOutput).toHaveBeenCalledWith('brew', ['info', '--json=v2', 'shopify-cli'], {
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
