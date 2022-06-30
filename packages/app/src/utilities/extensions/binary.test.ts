import {
  getBinaryPathOrDownload,
  getBinaryLocalPath,
  validatePlatformSupport,
  UnsupportedPlatformError,
  getArtifactName,
} from './binary.js'
import {versions} from '../../constants.js'
import {describe, it, expect, vi, test} from 'vitest'
import {http, file, path, os, checksum, constants} from '@shopify/cli-kit'
import {createGzip} from 'node:zlib'
import {createReadStream, createWriteStream} from 'node:fs'
import {promisify} from 'node:util'
import {pipeline} from 'node:stream'

vi.mock('@shopify/cli-kit', async () => {
  const module: any = await vi.importActual('@shopify/cli-kit')
  return {
    ...module,
    http: {
      fetch: vi.fn(),
    },
    checksum: {
      validateMD5: vi.fn(),
    },
    os: {
      platformAndArch: vi.fn(),
    },
    constants: {
      paths: {
        directories: {
          cache: {
            vendor: {
              binaries: vi.fn(),
            },
          },
        },
      },
    },
  }
})

describe('getBinaryLocalPath', () => {
  it('returns the right path when windows', async () => {
    // Given
    const binariesDirectory = '/binaries'
    vi.mocked(constants.paths.directories.cache.vendor.binaries).mockReturnValue(binariesDirectory)
    vi.mocked(os.platformAndArch).mockReturnValue({
      platform: 'windows',
      arch: 'arm64',
    })

    // When
    const got = await getBinaryLocalPath()

    // Then
    expect(got).toEqual(path.join(binariesDirectory, `extensions/${versions.extensionsBinary}-windows-arm64.exe`))
  })

  it('returns the right path when not windows', async () => {
    // Given
    const binariesDirectory = '/binaries'
    vi.mocked(constants.paths.directories.cache.vendor.binaries).mockReturnValue(binariesDirectory)
    vi.mocked(os.platformAndArch).mockReturnValue({
      platform: 'darwin',
      arch: 'arm64',
    })

    // When
    const got = await getBinaryLocalPath()

    // Then
    expect(got).toEqual(path.join(binariesDirectory, `extensions/${versions.extensionsBinary}-darwin-arm64`))
  })
})

describe('validatePlatformSupport', () => {
  it('throws if the platform and architecture are not supported', () => {
    // Given
    const platform = 'invalid'
    const arch = 'unsupported'

    // When/Then
    expect(() => {
      validatePlatformSupport({
        platform,
        arch,
      })
    }).toThrowError(UnsupportedPlatformError({platform, arch}))
  })

  it('doesn not throw in it is a valid platform and architecture', () => {
    // Given
    const platform = 'darwin'
    const arch = 'arm64'

    // When/Then
    validatePlatformSupport({
      platform,
      arch,
    })
  })
})

describe('getBinaryPathOrDownload', () => {
  it('returns the binary path if the binary already exists', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const binariesDirectory = path.join(tmpDir, 'binaries')
      vi.mocked(constants.paths.directories.cache.vendor.binaries).mockReturnValue(binariesDirectory)
      vi.mocked(os.platformAndArch).mockReturnValue({platform: 'darwin', arch: 'arm64'})
      const binaryLocalPath = await getBinaryLocalPath()
      const binary = 'binary'
      await file.mkdir(path.dirname(binaryLocalPath))
      await file.write(binaryLocalPath, binary)

      // When
      const got = await getBinaryPathOrDownload()

      // Then
      expect(got).toEqual(binaryLocalPath)
      expect(http.fetch).not.toHaveBeenCalled()
    })
  })

  it('throws an error if the platform and architecture are not supported', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const binariesDirectory = path.join(tmpDir, 'binaries')
      vi.mocked(constants.paths.directories.cache.vendor.binaries).mockReturnValue(binariesDirectory)
      vi.mocked(os.platformAndArch).mockReturnValue({platform: 'unsupported', arch: 'arm64'})
      const binaryLocalPath = await getBinaryLocalPath()

      // When/Then
      await expect(getBinaryPathOrDownload()).rejects.toThrowError(
        UnsupportedPlatformError({
          arch: 'arm64',
          platform: 'unsupported',
        }),
      )
    })
  })

  it('throws if the validation of the MD5 fails', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const binaryContent = 'binary'
      const binariesDirectory = path.join(tmpDir, 'binaries')
      const releaseArtifactsDirectory = path.join(tmpDir, 'release-artifacts')
      const releaseBinariesDirectory = path.join(tmpDir, 'relase-binary')
      const releaseBinary = path.join(releaseBinariesDirectory, 'extensions')
      const relaseArtifact = path.join(releaseArtifactsDirectory, 'extensions.gz')
      const md5ValidationError = new Error('MD5 validation failed')

      // Given: Creating directories
      await file.mkdir(releaseArtifactsDirectory)
      await file.mkdir(releaseBinariesDirectory)
      await file.write(releaseBinary, binaryContent)

      // Given: Compressing release binaries
      await promisify(pipeline)(createReadStream(releaseBinary), createGzip(), createWriteStream(relaseArtifact))

      vi.mocked(constants.paths.directories.cache.vendor.binaries).mockReturnValue(binariesDirectory)
      vi.mocked(os.platformAndArch).mockReturnValue({platform: 'darwin', arch: 'arm64'})
      const response: any = {
        body: createReadStream(relaseArtifact),
      }
      vi.mocked(http.fetch).mockResolvedValue(response)
      vi.mocked(checksum.validateMD5).mockRejectedValue(md5ValidationError)
      const binaryLocalPath = await getBinaryLocalPath()

      // When
      await expect(getBinaryPathOrDownload()).rejects.toThrowError(md5ValidationError)
    })
  })

  it('downloads, untars, and gives executable permissions', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const binaryContent = 'binary'
      const binariesDirectory = path.join(tmpDir, 'binaries')
      const releaseArtifactsDirectory = path.join(tmpDir, 'release-artifacts')
      const releaseBinariesDirectory = path.join(tmpDir, 'relase-binary')
      const releaseBinary = path.join(releaseBinariesDirectory, 'extensions')
      const relaseArtifact = path.join(releaseArtifactsDirectory, 'extensions.gz')

      // Given: Creating directories
      await file.mkdir(releaseArtifactsDirectory)
      await file.mkdir(releaseBinariesDirectory)
      await file.write(releaseBinary, binaryContent)

      // Given: Compressing release binaries
      await promisify(pipeline)(createReadStream(releaseBinary), createGzip(), createWriteStream(relaseArtifact))

      vi.mocked(constants.paths.directories.cache.vendor.binaries).mockReturnValue(binariesDirectory)
      vi.mocked(os.platformAndArch).mockReturnValue({platform: 'darwin', arch: 'arm64'})
      const response: any = {
        body: createReadStream(relaseArtifact),
      }
      vi.mocked(http.fetch).mockResolvedValue(response)

      // When
      const outputBinary = await getBinaryPathOrDownload()

      // Then
      await expect(file.read(outputBinary)).resolves.toEqual(binaryContent)
      await expect(file.hasExecutablePermissions(outputBinary)).resolves.toEqual(true)
    })
  })
})

describe('getArtifactName', () => {
  test("returns the right name when it's darwin", () => {
    // When
    const got = getArtifactName({
      arch: 'amd64',
      platform: 'darwin',
    })

    // Then
    expect(got).toMatchInlineSnapshot('"shopify-extensions-darwin-amd64"')
  })

  test("returns the right name when it's windows", () => {
    // When
    const got = getArtifactName({
      arch: 'amd64',
      platform: 'windows',
    })

    // Then
    expect(got).toMatchInlineSnapshot('"shopify-extensions-windows-amd64.exe"')
  })
})
