import {copySourceEntry} from './copy-source-entry.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {inTemporaryDirectory, writeFile, mkdir, fileExistsSync, readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

describe('copySourceEntry', () => {
  let mockStdout: any

  beforeEach(() => {
    mockStdout = {write: vi.fn()}
  })

  test('throws when source path does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const baseDir = joinPath(tmpDir, 'ext')
      const outputDir = joinPath(tmpDir, 'out')
      const appDirectory = tmpDir
      await mkdir(baseDir)
      await mkdir(outputDir)

      // When / Then
      await expect(
        copySourceEntry(
          {
            source: 'missing/file.js',
            destination: undefined,
            baseDir,
            outputDir,
            appDirectory,
          },
          {stdout: mockStdout},
        ),
      ).rejects.toThrow(`Source does not exist: ${joinPath(baseDir, 'missing/file.js')}`)
    })
  })

  test('copies file to explicit destination path', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const baseDir = joinPath(tmpDir, 'ext')
      const outputDir = joinPath(tmpDir, 'out')
      const appDirectory = tmpDir
      await mkdir(baseDir)
      await mkdir(outputDir)
      const sourceFile = joinPath(baseDir, 'src/icon.png')
      await mkdir(joinPath(baseDir, 'src'))
      await writeFile(sourceFile, 'icon-content')

      // When
      const result = await copySourceEntry(
        {
          source: 'src/icon.png',
          destination: 'assets/icon.png',
          baseDir,
          outputDir,
          appDirectory,
        },
        {stdout: mockStdout},
      )

      // Then
      const expectedDest = joinPath(outputDir, 'assets/icon.png')
      expect(fileExistsSync(expectedDest)).toBe(true)
      await expect(readFile(expectedDest)).resolves.toBe('icon-content')
      expect(result.filesCopied).toBe(1)
      expect(result.outputPaths).toEqual(['assets/icon.png'])
      expect(mockStdout.write).toHaveBeenCalledWith('Included src/icon.png\n')
    })
  })

  test('copies directory under its own name when no destination is given', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const baseDir = joinPath(tmpDir, 'ext')
      const outputDir = joinPath(tmpDir, 'out')
      const appDirectory = tmpDir
      await mkdir(baseDir)
      await mkdir(outputDir)

      const distDir = joinPath(baseDir, 'dist')
      await mkdir(distDir)
      await writeFile(joinPath(distDir, 'index.html'), 'html')
      await writeFile(joinPath(distDir, 'logo.png'), 'logo')

      // When
      const result = await copySourceEntry(
        {source: 'dist', destination: undefined, baseDir, outputDir, appDirectory},
        {stdout: mockStdout},
      )

      // Then
      expect(fileExistsSync(joinPath(outputDir, 'dist/index.html'))).toBe(true)
      expect(fileExistsSync(joinPath(outputDir, 'dist/logo.png'))).toBe(true)
      expect(result.filesCopied).toBe(2)
      expect(result.outputPaths).toHaveLength(2)
      expect(result.outputPaths).toEqual(expect.arrayContaining(['dist/index.html', 'dist/logo.png']))
      expect(mockStdout.write).toHaveBeenCalledWith('Included dist\n')
    })
  })

  test('copies file to basename in outputDir when source is a file and no destination given', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const baseDir = joinPath(tmpDir, 'ext')
      const outputDir = joinPath(tmpDir, 'out')
      const appDirectory = tmpDir
      await mkdir(baseDir)
      await mkdir(outputDir)
      await writeFile(joinPath(baseDir, 'README.md'), 'readme')

      // When
      const result = await copySourceEntry(
        {source: 'README.md', destination: undefined, baseDir, outputDir, appDirectory},
        {stdout: mockStdout},
      )

      // Then
      const expectedDest = joinPath(outputDir, 'README.md')
      expect(fileExistsSync(expectedDest)).toBe(true)
      await expect(readFile(expectedDest)).resolves.toBe('readme')
      expect(result.filesCopied).toBe(1)
      expect(result.outputPaths).toEqual(['README.md'])
      expect(mockStdout.write).toHaveBeenCalledWith('Included README.md\n')
    })
  })

  test('copies directory to explicit destination path', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const baseDir = joinPath(tmpDir, 'ext')
      const outputDir = joinPath(tmpDir, 'out')
      const appDirectory = tmpDir
      await mkdir(baseDir)
      await mkdir(outputDir)

      const distDir = joinPath(baseDir, 'dist')
      await mkdir(distDir)
      await writeFile(joinPath(distDir, 'x.js'), 'js')

      // When
      const result = await copySourceEntry(
        {source: 'dist', destination: 'vendor/dist', baseDir, outputDir, appDirectory},
        {stdout: mockStdout},
      )

      // Then
      expect(fileExistsSync(joinPath(outputDir, 'vendor/dist/x.js'))).toBe(true)
      expect(result.filesCopied).toBe(1)
      expect(result.outputPaths).toEqual(['vendor/dist/x.js'])
      expect(mockStdout.write).toHaveBeenCalledWith('Included dist\n')
    })
  })

  test('returns count of files discovered in destination directory after directory copy', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const baseDir = joinPath(tmpDir, 'ext')
      const outputDir = joinPath(tmpDir, 'out')
      const appDirectory = tmpDir
      await mkdir(baseDir)
      await mkdir(outputDir)

      const themeDir = joinPath(baseDir, 'theme')
      await mkdir(themeDir)
      await writeFile(joinPath(themeDir, 'a.js'), 'a')
      await writeFile(joinPath(themeDir, 'b.js'), 'b')
      await writeFile(joinPath(themeDir, 'c.js'), 'c')
      await writeFile(joinPath(themeDir, 'd.js'), 'd')
      await writeFile(joinPath(themeDir, 'e.js'), 'e')

      // When
      const result = await copySourceEntry(
        {source: 'theme', destination: undefined, baseDir, outputDir, appDirectory},
        {stdout: mockStdout},
      )

      // Then
      expect(result.filesCopied).toBe(5)
      expect(result.outputPaths).toHaveLength(5)
      expect(result.outputPaths).toEqual(
        expect.arrayContaining(['theme/a.js', 'theme/b.js', 'theme/c.js', 'theme/d.js', 'theme/e.js']),
      )
    })
  })

  test('creates parent directories before copying a file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const baseDir = joinPath(tmpDir, 'ext')
      const outputDir = joinPath(tmpDir, 'out')
      const appDirectory = tmpDir
      await mkdir(baseDir)
      await mkdir(outputDir)

      const deepDir = joinPath(baseDir, 'src/deep')
      await mkdir(deepDir)
      await writeFile(joinPath(deepDir, 'icon.png'), 'icon')

      // When
      await copySourceEntry(
        {
          source: 'src/deep/icon.png',
          destination: 'assets/icons/icon.png',
          baseDir,
          outputDir,
          appDirectory,
        },
        {stdout: mockStdout},
      )

      // Then — parent of destination path created
      expect(fileExistsSync(joinPath(outputDir, 'assets/icons/icon.png'))).toBe(true)
    })
  })
})
