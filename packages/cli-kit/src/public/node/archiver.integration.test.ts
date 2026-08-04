import {zip, brotliCompress} from './archiver.js'
import {fileExists, inTemporaryDirectory, mkdir, touchFile} from './fs.js'
import {joinPath, dirname} from './path.js'
import * as pathLib from './path.js'
import {exec} from './system.js'
import * as fsLib from './fs.js'
import {describe, expect, test, vi} from 'vitest'
import StreamZip from 'node-stream-zip'
import {brotliDecompressSync} from 'zlib'
import {readFile} from 'fs/promises'

import fs from 'fs'

vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>()
  return {
    ...actual,
    readFile: vi.fn(async (path, options) => {
      const archiveInstance = (globalThis as any).__latestArchiveInstance
      if (archiveInstance && (globalThis as any).__shouldEmitArchiveError) {
        // Clear flag so we only emit once
        ;(globalThis as any).__shouldEmitArchiveError = false
        archiveInstance.emit('error', new Error('Mocked archive error'))
      }
      return actual.readFile(path, options)
    }),
  }
})

vi.mock('archiver', async (importOriginal) => {
  const actual = await importOriginal<typeof import('archiver')>()
  const mockArchiver = (format: string, options?: any) => {
    const defaultExport = (actual as any).default ?? actual
    const instance = defaultExport(format, options)
    ;(globalThis as any).__latestArchiveInstance = instance
    return instance
  }
  return {
    ...actual,
    default: mockArchiver,
  }
})

describe('zip', () => {
  test('zips a directory', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const zipPath = joinPath(tmpDir, 'output.zip')
      const outputDirectoryName = 'output'
      const outputDirectoryPath = joinPath(tmpDir, outputDirectoryName)
      const structure = ['extensions/first/main.js', 'test.json']

      await createFiles(structure, outputDirectoryPath)

      // When
      await zip({
        inputDirectory: outputDirectoryPath,
        outputZipPath: zipPath,
      })

      // Then
      const archiveEntries = await readArchiveFiles(zipPath)
      const expectedEntries = ['extensions/', 'extensions/first/', 'extensions/first/main.js', 'test.json']
      expect(expectedEntries.sort()).toEqual(archiveEntries.sort())
    })
  })

  test('only zips files that match input pattern', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const zipPath = joinPath(tmpDir, 'output.zip')
      const outputDirectoryName = 'output'
      const outputDirectoryPath = joinPath(tmpDir, outputDirectoryName)
      const structure = ['extensions/first/main.js', 'test.json']

      await createFiles(structure, outputDirectoryPath)

      // When
      await zip({
        inputDirectory: outputDirectoryPath,
        outputZipPath: zipPath,
        matchFilePattern: '**/extensions/**',
      })

      // Then
      const archiveEntries = await readArchiveFiles(zipPath)

      expect(archiveEntries).toContain('extensions/')
      expect(archiveEntries).toContain('extensions/first/')
      const expectedEntries = ['extensions/', 'extensions/first/', 'extensions/first/main.js']
      expect(expectedEntries.sort()).toEqual(archiveEntries.sort())
    })
  })

  test('propagates error when file reading fails', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const zipPath = joinPath(tmpDir, 'output.zip')
      const outputDirectoryPath = joinPath(tmpDir, 'output')
      const structure = ['test.json']

      await createFiles(structure, outputDirectoryPath)

      // Mock readFile to fail with an Error instance
      vi.mocked(readFile).mockRejectedValueOnce(new Error('Failed to read file'))

      // When/Then
      await expect(
        zip({
          inputDirectory: outputDirectoryPath,
          outputZipPath: zipPath,
        }),
      ).rejects.toThrow('Failed to read file')
    })
  })

  test('gracefully returns early if filePath or relativePath is empty', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const zipPath = joinPath(tmpDir, 'output.zip')
      const outputDirectoryPath = joinPath(tmpDir, 'output')
      await mkdir(outputDirectoryPath)

      // Capture original glob and relativePath, and spy to return mocked paths and empty relative paths
      const originalGlob = fsLib.glob
      const globSpy = vi.spyOn(fsLib, 'glob').mockImplementation((pattern, options) => {
        if (pattern === 'mocked-empty-pattern') {
          return Promise.resolve(['', outputDirectoryPath])
        }
        return originalGlob(pattern, options)
      })

      const originalRelativePath = pathLib.relativePath
      const relativePathSpy = vi.spyOn(pathLib, 'relativePath').mockImplementation((from, to) => {
        if (to === '') {
          return ''
        }
        return originalRelativePath(from, to)
      })

      // When
      await zip({
        inputDirectory: outputDirectoryPath,
        outputZipPath: zipPath,
        matchFilePattern: 'mocked-empty-pattern',
      })

      // Then - should complete without errors
      const exists = await fileExists(zipPath)
      expect(exists).toBeTruthy()

      globSpy.mockRestore()
      relativePathSpy.mockRestore()
    })
  })

  test('propagates archive stream errors', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const zipPath = joinPath(tmpDir, 'output.zip')
      const outputDirectoryPath = joinPath(tmpDir, 'output')
      const structure = ['test.json']
      await createFiles(structure, outputDirectoryPath)
      ;(globalThis as any).__shouldEmitArchiveError = true

      // When
      const zipPromise = zip({
        inputDirectory: outputDirectoryPath,
        outputZipPath: zipPath,
      })

      // Then
      await expect(zipPromise).rejects.toThrow('Mocked archive error')
      ;(globalThis as any).__shouldEmitArchiveError = false
    })
  })
})

describe('brotliCompress', () => {
  test('compresses a directory with brotli', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const brotliPath = joinPath(tmpDir, 'output.br')
      const outputDirectoryName = 'output'
      const outputDirectoryPath = joinPath(tmpDir, outputDirectoryName)
      const testContent = 'test content'

      // Create test file
      await mkdir(outputDirectoryPath)
      await touchFile(joinPath(outputDirectoryPath, 'test.txt'))
      fs.writeFileSync(joinPath(outputDirectoryPath, 'test.txt'), testContent)

      // When
      await brotliCompress({
        inputDirectory: outputDirectoryPath,
        outputPath: brotliPath,
      })

      // Then
      // Verify file exists and is compressed
      const exists = await fileExists(brotliPath)
      expect(exists).toBeTruthy()

      const compressedContent = fs.readFileSync(brotliPath)
      expect(compressedContent.length).toBeGreaterThan(0)

      // Verify it's a valid brotli file by checking the header bytes
      // Brotli files start with the bytes 0x1B...
      expect(compressedContent[0]).toBe(0x1b)

      // Decompress using native zlib brotli
      const decompressed = brotliDecompressSync(compressedContent)
      expect(decompressed).toBeTruthy()
    })
  })

  test('only compresses files that match input pattern', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const brotliPath = joinPath(tmpDir, 'output.br')
      const outputDirectoryName = 'output'
      const outputDirectoryPath = joinPath(tmpDir, outputDirectoryName)
      const structure = ['extensions/first/main.js', 'test.json']

      await createFiles(structure, outputDirectoryPath)

      // When
      await brotliCompress({
        inputDirectory: outputDirectoryPath,
        outputPath: brotliPath,
        matchFilePattern: '**/extensions/**',
      })

      // Then
      const exists = await fileExists(brotliPath)
      expect(exists).toBeTruthy()

      // Create a temporary directory to extract the tar archive
      const extractPath = joinPath(tmpDir, 'extract')
      await mkdir(extractPath)

      // Save compressed content to a file
      const compressedContent = fs.readFileSync(brotliPath)
      const decompressed = brotliDecompressSync(compressedContent)
      const tmpTarPath = joinPath(tmpDir, 'output.tar')
      fs.writeFileSync(tmpTarPath, decompressed)

      // Extract the tar
      const tarArgs = ['-xf', tmpTarPath, '-C', extractPath]
      await exec('tar', tarArgs)

      // Verify only the extension file exists
      const extractedFiles = fs.readdirSync(joinPath(extractPath, 'extensions/first'))
      expect(extractedFiles).toContain('main.js')

      // Verify the root file does not exist
      expect(fs.existsSync(joinPath(extractPath, 'test.json'))).toBeFalsy()
    })
  })

  test('propagates error when file reading fails', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const brotliPath = joinPath(tmpDir, 'output.br')
      const outputDirectoryPath = joinPath(tmpDir, 'output')
      const structure = ['test.json']

      await createFiles(structure, outputDirectoryPath)

      // Mock readFile to fail with a non-Error string
      vi.mocked(readFile).mockRejectedValueOnce('Failed to read file')

      // When/Then
      await expect(
        brotliCompress({
          inputDirectory: outputDirectoryPath,
          outputPath: brotliPath,
        }),
      ).rejects.toThrow('Failed to read file')
    })
  })

  test('propagates error when file reading fails with a non-Error string', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const brotliPath = joinPath(tmpDir, 'output.br')
      const outputDirectoryPath = joinPath(tmpDir, 'output')
      const structure = ['test.json']

      await createFiles(structure, outputDirectoryPath)

      // Mock readFile to fail with a non-Error string
      vi.mocked(readFile).mockRejectedValueOnce('Failed to read file string')

      // When/Then
      await expect(
        brotliCompress({
          inputDirectory: outputDirectoryPath,
          outputPath: brotliPath,
        }),
      ).rejects.toThrow('Failed to read file string')
    })
  })

  test('handles cleanup failure gracefully when temp tar cannot be deleted', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const brotliPath = joinPath(tmpDir, 'output.br')
      const outputDirectoryPath = joinPath(tmpDir, 'output')
      const structure = ['test.json']

      await createFiles(structure, outputDirectoryPath)

      // Spy on removeFile to mock a failure
      const removeFileSpy = vi.spyOn(fsLib, 'removeFile').mockRejectedValue(new Error('Failed to delete temp file'))

      // When
      await brotliCompress({
        inputDirectory: outputDirectoryPath,
        outputPath: brotliPath,
      })

      // Then - should still compress successfully despite cleanup failure
      const exists = await fileExists(brotliPath)
      expect(exists).toBeTruthy()

      removeFileSpy.mockRestore()
    })
  })
})

async function createFiles(structure: string[], directory: string) {
  for (const fileRelativePath of structure) {
    const filePath = joinPath(directory, fileRelativePath)
    // eslint-disable-next-line no-await-in-loop
    await mkdir(dirname(filePath))
    // eslint-disable-next-line no-await-in-loop
    await touchFile(filePath)
  }
}

async function readArchiveFiles(zipPath: string) {
  await expect(fileExists(zipPath)).resolves.toBeTruthy()
  // eslint-disable-next-line new-cap
  const archive = new StreamZip.async({file: zipPath})
  const archiveEntries = Object.keys(await archive.entries())
  await archive.close()

  return archiveEntries
}
