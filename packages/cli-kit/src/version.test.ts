import {findPackageVersionUp, latestNpmPackageVersion, PackageJsonNotFoundError} from './version.js'
import {inTemporaryDirectory, mkdir, write} from './file.js'
import {join as pathJoin} from './path.js'
import {describe, it, expect, vi, test} from 'vitest'
import latestVersion from 'latest-version'
import {pathToFileURL} from 'node:url'

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

describe('findPackageVersionUp', () => {
  test('returns the version if a package.json exists', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const subDirectory = pathJoin(tmpDir, 'subdir')
      const version = '1.2.3'
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      await mkdir(subDirectory)
      const packageJson = {version}
      await write(packageJsonPath, JSON.stringify(packageJson))

      // When
      const got = await findPackageVersionUp({fromModuleURL: pathToFileURL(pathJoin(subDirectory, 'file.js'))})

      // Then
      expect(got).toEqual(version)
    })
  })

  test("throws a PackageJsonNotFoundError error if a package.json doesn't exist", async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const subDirectory = pathJoin(tmpDir, 'subdir')
      await mkdir(subDirectory)

      // When/Then

      await expect(
        findPackageVersionUp({fromModuleURL: pathToFileURL(pathJoin(subDirectory, 'file.js'))}),
      ).rejects.toThrowError(PackageJsonNotFoundError(subDirectory))
    })
  })
})
