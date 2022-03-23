import {getBinaryPathOrDownload, getBinaryLocalPath, validatePlatformSupport, UnsupportedPlatformError} from './binary'
import {directory as getVendorDirectory} from '../vendor-directory'
import {versions} from '$cli/constants'
import {describe, it, expect, vi, afterEach} from 'vitest'
import {http, file, path, os, checksum} from '@shopify/cli-kit'
import {temporary} from '@shopify/cli-testing'
import {createGzip} from 'node:zlib'
import {createReadStream, createWriteStream} from 'node:fs'
import {promisify} from 'node:util'
import {pipeline} from 'node:stream'

vi.mock('../vendor-directory')
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
  }
})

afterEach(async () => {
  await vi.mocked(getVendorDirectory).mockClear()
  await vi.mocked(os.platformAndArch).mockClear()
})

describe('getBinaryLocalPath', () => {
  it('returns the right path when windows', async () => {
    // Given
    const vendorDirectory = '/vendor'
    vi.mocked(getVendorDirectory).mockResolvedValue(vendorDirectory)
    vi.mocked(os.platformAndArch).mockReturnValue({
      platform: 'windows',
      arch: 'arm64',
    })

    // When
    const got = await getBinaryLocalPath()

    // Then
    expect(got).toEqual(
      path.join(vendorDirectory, `binaries/extensions/${versions.extensionsBinary}-windows-arm64.exe`),
    )
  })

  it('returns the right path when not windows', async () => {
    // Given
    const vendorDirectory = '/vendor'
    vi.mocked(getVendorDirectory).mockResolvedValue(vendorDirectory)
    vi.mocked(os.platformAndArch).mockReturnValue({
      platform: 'darwin',
      arch: 'arm64',
    })

    // When
    const got = await getBinaryLocalPath()

    // Then
    expect(got).toEqual(path.join(vendorDirectory, `binaries/extensions/${versions.extensionsBinary}-darwin-arm64`))
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
    await temporary.directory(async (tmpDir) => {
      // Given
      const vendorDirectory = path.join(tmpDir, 'vendor')
      vi.mocked(getVendorDirectory).mockResolvedValue(vendorDirectory)
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
    await temporary.directory(async (tmpDir) => {
      // Given
      const vendorDirectory = path.join(tmpDir, 'vendor')
      vi.mocked(getVendorDirectory).mockResolvedValue(vendorDirectory)
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
    await temporary.directory(async (tmpDir) => {
      // Given
      const binaryContent = 'binary'
      const vendorDirectory = path.join(tmpDir, 'vendor')
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

      vi.mocked(getVendorDirectory).mockResolvedValue(vendorDirectory)
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
    await temporary.directory(async (tmpDir) => {
      // Given
      const binaryContent = 'binary'
      const vendorDirectory = path.join(tmpDir, 'vendor')
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

      vi.mocked(getVendorDirectory).mockResolvedValue(vendorDirectory)
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
