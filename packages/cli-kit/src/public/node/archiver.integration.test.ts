import {zip, brotliCompress} from './archiver.js'
import {fileExists, inTemporaryDirectory, mkdir, touchFile} from './fs.js'
import {joinPath, dirname} from './path.js'
import {exec} from './system.js'
import {describe, expect, test} from 'vitest'
import StreamZip from 'node-stream-zip'
import brotli from 'brotli'
import fs from 'fs'

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
      expect(structure.sort()).toEqual(archiveEntries.sort())
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
      expect([`extensions/first/main.js`]).toEqual(archiveEntries)
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
      const extractPath = joinPath(tmpDir, 'extract')
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

      // Decompress using brotli library
      const decompressed = brotli.decompress(compressedContent)
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
      const decompressed = brotli.decompress(compressedContent)
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
  // eslint-disable-next-line @babel/new-cap
  const archive = new StreamZip.async({file: zipPath})
  const archiveEntries = Object.keys(await archive.entries())
  await archive.close()

  return archiveEntries
}
