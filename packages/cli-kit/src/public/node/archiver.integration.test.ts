import {zip} from './archiver.js'
import {fileExists, inTemporaryDirectory, mkdir, touchFile} from './fs.js'
import {joinPath, dirname} from './path.js'
import {describe, expect, test} from 'vitest'
import StreamZip from 'node-stream-zip'

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
