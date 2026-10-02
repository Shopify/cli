import {writeManifestToBundle, compressBundle, uploadToGCS, BUNDLE_EXCLUSION_PATTERNS} from './bundle.js'
import {AppInterface} from '../models/app/app.js'
import {describe, test, expect, vi} from 'vitest'
import {joinPath} from '@shopify/cli-kit/node/path'
import {inTemporaryDirectory, mkdir, writeFile, readFile, fileSize} from '@shopify/cli-kit/node/fs'
import {brotliCompress, zip} from '@shopify/cli-kit/node/archiver'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fetch} from '@shopify/cli-kit/node/http'
import {sleep} from '@shopify/cli-kit/node/system'

vi.mock('@shopify/cli-kit/node/archiver', () => {
  return {
    brotliCompress: vi.fn(),
    zip: vi.fn(),
  }
})

vi.mock('@shopify/cli-kit/node/http', async (importActual) => {
  const actual: any = await importActual()
  return {...actual, fetch: vi.fn()}
})

vi.mock('@shopify/cli-kit/node/fs', async (importActual) => {
  const actual: any = await importActual()
  return {...actual, fileSize: vi.fn(actual.fileSize)}
})

vi.mock('@shopify/cli-kit/node/system', async (importActual) => {
  const actual: any = await importActual()
  return {...actual, sleep: vi.fn()}
})

describe('writeManifestToBundle', () => {
  test('writes manifest.json to the specified directory', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const manifestContent = {
        name: 'Test App',
        version: '1.0.0',
      }
      const mockApp = {
        manifest: async () => manifestContent,
      } as unknown as AppInterface

      const appManifest = await mockApp.manifest(undefined)

      // When
      await writeManifestToBundle(appManifest, tmpDir)

      // Then
      const manifestPath = joinPath(tmpDir, 'manifest.json')
      const manifest = await readFile(manifestPath)
      expect(JSON.parse(manifest)).toEqual(manifestContent)
    })
  })
})

describe('compressBundle', () => {
  test('creates a zip file from the input directory', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const inputDir = joinPath(tmpDir, 'input')
      const outputZip = joinPath(tmpDir, 'output.zip')
      await mkdir(inputDir)
      await writeFile(joinPath(inputDir, 'test.txt'), 'test content')

      // When
      await compressBundle(inputDir, outputZip)

      // Then
      expect(zip).toHaveBeenCalledWith({
        inputDirectory: inputDir,
        outputZipPath: outputZip,
        matchFilePattern: ['**/*', ...BUNDLE_EXCLUSION_PATTERNS],
      })
      expect(brotliCompress).not.toHaveBeenCalled()
    })
  })

  test('excludes .js.map files from the zip', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const inputDir = joinPath(tmpDir, 'input')
      const outputZip = joinPath(tmpDir, 'output.zip')
      await mkdir(inputDir)
      await writeFile(joinPath(inputDir, 'test.txt'), 'test content')
      await writeFile(joinPath(inputDir, 'test.js.map'), 'test content')

      // When
      await compressBundle(inputDir, outputZip)

      // Then
      expect(zip).toHaveBeenCalledWith(
        expect.objectContaining({
          matchFilePattern: ['**/*', ...BUNDLE_EXCLUSION_PATTERNS],
        }),
      )
    })
  })

  test('creates a brotli compressed file when the output path ends with .br', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const inputDir = joinPath(tmpDir, 'input')
      const outputBr = joinPath(tmpDir, 'output.br')
      await mkdir(inputDir)
      await writeFile(joinPath(inputDir, 'test.txt'), 'test content')

      // When
      await compressBundle(inputDir, outputBr)

      // Then
      expect(brotliCompress).toHaveBeenCalledWith({
        inputDirectory: inputDir,
        outputPath: outputBr,
        matchFilePattern: ['**/*', ...BUNDLE_EXCLUSION_PATTERNS],
      })
      expect(zip).not.toHaveBeenCalled()
    })
  })

  test('excludes .js.map files from the brotli compressed file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const inputDir = joinPath(tmpDir, 'input')
      const outputBr = joinPath(tmpDir, 'output.br')
      await mkdir(inputDir)
      await writeFile(joinPath(inputDir, 'test.txt'), 'test content')
      await writeFile(joinPath(inputDir, 'test.js.map'), 'test content')

      // When
      await compressBundle(inputDir, outputBr)

      // Then
      expect(brotliCompress).toHaveBeenCalledWith(
        expect.objectContaining({
          matchFilePattern: ['**/*', ...BUNDLE_EXCLUSION_PATTERNS],
        }),
      )
    })
  })

  test('excludes .metafile.json files from the zip', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const inputDir = joinPath(tmpDir, 'input')
      const outputZip = joinPath(tmpDir, 'output.zip')
      await mkdir(inputDir)
      await writeFile(joinPath(inputDir, 'test.txt'), 'test content')
      await writeFile(joinPath(inputDir, 'main.metafile.json'), '{"inputs":{},"outputs":{}}')

      // When
      await compressBundle(inputDir, outputZip)

      // Then
      expect(zip).toHaveBeenCalledWith(
        expect.objectContaining({
          matchFilePattern: ['**/*', ...BUNDLE_EXCLUSION_PATTERNS],
        }),
      )
    })
  })

  test('uses custom file patterns as-is when provided', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const inputDir = joinPath(tmpDir, 'input')
      const outputZip = joinPath(tmpDir, 'output.zip')
      await mkdir(inputDir)
      await writeFile(joinPath(inputDir, 'test.txt'), 'test content')

      // When
      await compressBundle(inputDir, outputZip, ['ext1/**', 'manifest.json'])

      // Then
      expect(zip).toHaveBeenCalledWith(
        expect.objectContaining({
          matchFilePattern: ['ext1/**', 'manifest.json'],
        }),
      )
    })
  })

  test('selects compression method based on file extension', async () => {
    // Given
    const inputDir = '/test/input'
    const zipOutput = '/test/output.zip'
    const brOutput = '/test/output.br'

    // When
    await compressBundle(inputDir, zipOutput)
    await compressBundle(inputDir, brOutput)

    // Then
    // For .zip
    expect(zip).toHaveBeenCalledTimes(1)
    // For .br
    expect(brotliCompress).toHaveBeenCalledTimes(1)

    // Verify specific calls
    expect(zip).toHaveBeenCalledWith(
      expect.objectContaining({
        outputZipPath: zipOutput,
      }),
    )
    expect(brotliCompress).toHaveBeenCalledWith(
      expect.objectContaining({
        outputPath: brOutput,
      }),
    )
  })
})

describe('uploadToGCS', () => {
  test('uploads the bundle when it is under the size limit', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const bundlePath = joinPath(tmpDir, 'bundle.zip')
      await writeFile(bundlePath, 'small contents')
      vi.mocked(fetch).mockResolvedValue({ok: true, status: 200} as never)

      // When
      await uploadToGCS('https://signed.example/upload', bundlePath)

      // Then
      expect(fetch).toHaveBeenCalledWith(
        'https://signed.example/upload',
        expect.objectContaining({method: 'put'}),
        'slow-request',
      )
    })
  })

  test('throws when the upload returns a non-2xx status so a failed upload is not treated as a success', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const bundlePath = joinPath(tmpDir, 'bundle.zip')
      await writeFile(bundlePath, 'small contents')
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve('<Error>SignatureExpired</Error>'),
      } as never)

      // When / Then
      await expect(uploadToGCS('https://signed.example/upload', bundlePath)).rejects.toThrow(AbortError)
      await expect(uploadToGCS('https://signed.example/upload', bundlePath)).rejects.toThrow(/HTTP 403/)
      // A 403 is not retryable, so it is attempted exactly once per call.
      expect(fetch).toHaveBeenCalledTimes(2)
    })
  })

  test('retries transient upload failures and succeeds', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const bundlePath = joinPath(tmpDir, 'bundle.zip')
      await writeFile(bundlePath, 'small contents')
      vi.mocked(fetch)
        .mockResolvedValueOnce({ok: false, status: 503, text: () => Promise.resolve('unavailable')} as never)
        .mockResolvedValueOnce({ok: true, status: 200} as never)

      // When
      await uploadToGCS('https://signed.example/upload', bundlePath)

      // Then
      expect(fetch).toHaveBeenCalledTimes(2)
      expect(sleep).toHaveBeenCalledTimes(1)
    })
  })

  test('gives up after exhausting retries on persistent transient failures', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const bundlePath = joinPath(tmpDir, 'bundle.zip')
      await writeFile(bundlePath, 'small contents')
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 503,
        text: () => Promise.resolve('unavailable'),
      } as never)

      // When / Then
      await expect(uploadToGCS('https://signed.example/upload', bundlePath)).rejects.toThrow(/HTTP 503/)
      expect(fetch).toHaveBeenCalledTimes(3)
    })
  })

  test('aborts with a helpful error when the bundle exceeds the 100 MB upload limit', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given — mock the reported size so CI doesn't have to allocate 101 MB on disk.
      const bundlePath = joinPath(tmpDir, 'huge.zip')
      await writeFile(bundlePath, 'placeholder')
      const oneHundredOneMb = 101 * 1024 * 1024
      vi.mocked(fileSize).mockResolvedValueOnce(oneHundredOneMb).mockResolvedValueOnce(oneHundredOneMb)
      vi.mocked(fetch).mockResolvedValue({} as never)

      // When / Then
      await expect(uploadToGCS('https://signed.example/upload', bundlePath)).rejects.toThrow(AbortError)
      await expect(uploadToGCS('https://signed.example/upload', bundlePath)).rejects.toThrow(
        /exceeds the 100 MB upload limit/,
      )
      expect(fetch).not.toHaveBeenCalled()
    })
  })
})
