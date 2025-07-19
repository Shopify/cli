import {writeManifestToBundle, compressBundle} from './bundle.js'
import {AppInterface} from '../models/app/app.js'
import {describe, test, expect, vi} from 'vitest'
import {joinPath} from '@shopify/cli-kit/node/path'
import {inTemporaryDirectory, mkdir, writeFile, readFile} from '@shopify/cli-kit/node/fs'
import {brotliCompress, zip} from '@shopify/cli-kit/node/archiver'

vi.mock('@shopify/cli-kit/node/archiver', () => {
  return {
    brotliCompress: vi.fn(),
    zip: vi.fn(),
  }
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

      // When
      await writeManifestToBundle(mockApp, tmpDir, undefined)

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
        matchFilePattern: ['**/*', '!**/*.js.map'],
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
          matchFilePattern: ['**/*', '!**/*.js.map'],
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
        matchFilePattern: ['**/*', '!**/*.js.map'],
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
          matchFilePattern: ['**/*', '!**/*.js.map'],
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
