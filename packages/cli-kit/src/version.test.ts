import {describe, it, expect, vi} from 'vitest'
import latestVersion from 'latest-version'

import {currentVersion, latestNpmPackageVersion} from './version'

vi.mock('latest-version')
const mockedLatestVersion = vi.mocked(latestVersion)

describe('latestNpmPackageVersion', () => {
  it('proxies the fetching to latest-version', async () => {
    // Given
    const version = '1.2.3'
    mockedLatestVersion.mockResolvedValue(version)

    // When
    const got = await latestNpmPackageVersion('@shopify/cli')

    // Then
    expect(got).toBe(version)
    expect(mockedLatestVersion).toHaveBeenCalledWith('@shopify/cli')
  })
})

describe('currentPackageVersion', () => {
  it('returns the current version of the given package', () => {
    const got = currentVersion('cli')

    expect(got).toBe('0.16.0')
  })
})
