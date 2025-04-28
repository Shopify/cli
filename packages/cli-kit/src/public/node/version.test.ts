import {localCLIVersion, globalCLIVersion} from './version.js'
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
})

describe('globalCLIVersion', () => {
  test('returns the version when a recent CLI is installed globally', async () => {
    // Given
    vi.mocked(captureOutput).mockImplementationOnce(() => Promise.resolve('3.65.0'))

    // When
    const got = await globalCLIVersion()

    // Then
    expect(got).toBe('3.65.0')
  })

  test('returns undefined when the global version is older than 3.59', async () => {
    // Given
    vi.mocked(captureOutput).mockImplementationOnce(() => Promise.resolve('3.55.0'))

    // When
    const got = await globalCLIVersion()

    // Then
    expect(got).toBeUndefined()
  })

  test('returns undefined when the global version is not installed', async () => {
    // Given
    vi.mocked(which).mockImplementationOnce(() => Promise.resolve('command not found: shopify'))

    // When
    const got = await globalCLIVersion()

    // Then
    expect(got).toBeUndefined()
  })
})
