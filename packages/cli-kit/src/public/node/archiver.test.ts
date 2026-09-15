import {zip, brotliCompress} from './archiver.js'
import {inTemporaryDirectory, writeFileSync, fileExists, mkdir, readFile} from './fs.js'
import {joinPath} from './path.js'
import {exec} from './system.js'
import {describe, expect, test} from 'vitest'
import StreamZip from 'node-stream-zip'
import {brotliDecompressSync} from 'zlib'
import {writeFileSync as nodeWriteFileSync} from 'node:fs'
import {readFile as fsPromisesReadFile} from 'node:fs/promises'

describe('zip', () => {
  test('zips directory files including subdirectories and respects matchFilePattern', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const inputDir = joinPath(tmpDir, 'input')
      const subDir = joinPath(inputDir, 'nested')
      await mkdir(subDir)

      const file1Path = joinPath(inputDir, 'file1.txt')
      const file2Path = joinPath(subDir, 'file2.js')
      const file3Path = joinPath(inputDir, 'file3.log')

      writeFileSync(file1Path, 'hello world')
      writeFileSync(file2Path, 'console.log("test")')
      writeFileSync(file3Path, 'log entry')

      const zipPath = joinPath(tmpDir, 'output.zip')

      await zip({
        inputDirectory: inputDir,
        outputZipPath: zipPath,
        matchFilePattern: ['**/*.txt', '**/*.js'],
      })

      await expect(fileExists(zipPath)).resolves.toBe(true)

      // eslint-disable-next-line new-cap
      const zipFile = new StreamZip.async({file: zipPath})
      const entries = Object.keys(await zipFile.entries())

      expect(entries).toContain('file1.txt')
      expect(entries).toContain('nested/')
      expect(entries).toContain('nested/file2.js')
      expect(entries).not.toContain('file3.log')

      const file1Buffer = await zipFile.entryData('file1.txt')
      expect(file1Buffer.toString('utf-8')).toBe('hello world')

      await zipFile.close()
    })
  })
})

describe('brotliCompress', () => {
  test('compresses directory contents into a brotli tarball', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const inputDir = joinPath(tmpDir, 'input')
      const subDir = joinPath(inputDir, 'sub')
      await mkdir(subDir)

      const file1Path = joinPath(inputDir, 'a.txt')
      const file2Path = joinPath(subDir, 'b.txt')

      writeFileSync(file1Path, 'alpha')
      writeFileSync(file2Path, 'beta')

      const outputPath = joinPath(tmpDir, 'archive.tar.br')

      await brotliCompress({
        inputDirectory: inputDir,
        outputPath,
      })

      await expect(fileExists(outputPath)).resolves.toBe(true)

      const compressedData = await fsPromisesReadFile(outputPath)
      const decompressedTar = brotliDecompressSync(compressedData)

      const extractedDir = joinPath(tmpDir, 'extracted')
      await mkdir(extractedDir)
      const tarPath = joinPath(tmpDir, 'extracted.tar')
      nodeWriteFileSync(tarPath, decompressedTar)

      await exec('tar', ['-xf', tarPath, '-C', extractedDir])

      await expect(fileExists(joinPath(extractedDir, 'a.txt'))).resolves.toBe(true)
      await expect(fileExists(joinPath(extractedDir, 'sub', 'b.txt'))).resolves.toBe(true)

      const fileAContent = await readFile(joinPath(extractedDir, 'a.txt'))
      const fileBContent = await readFile(joinPath(extractedDir, 'sub', 'b.txt'))

      expect(fileAContent).toBe('alpha')
      expect(fileBContent).toBe('beta')
    })
  })
})
