import {copyByPattern} from './copy-by-pattern.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {inTemporaryDirectory, writeFile, mkdir, fileExistsSync} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

describe('copyByPattern', () => {
  let mockStdout: any

  beforeEach(() => {
    mockStdout = {write: vi.fn()}
  })

  test('copies matched files preserving relative paths', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const sourceDir = joinPath(tmpDir, 'src')
      const outputDir = joinPath(tmpDir, 'out')
      await mkdir(sourceDir)
      await mkdir(joinPath(sourceDir, 'components'))
      await mkdir(joinPath(sourceDir, 'utils'))
      await writeFile(joinPath(sourceDir, 'components/Button.tsx'), 'content')
      await writeFile(joinPath(sourceDir, 'utils/helpers.ts'), 'content')

      // When
      const result = await copyByPattern(
        {
          sourceDir,
          outputDir,
          patterns: ['**/*.ts', '**/*.tsx'],
          ignore: [],
          appDirectory: sourceDir,
          sourceDirConfigValue: '.',
        },
        {stdout: mockStdout},
      )

      // Then
      expect(fileExistsSync(joinPath(outputDir, 'components/Button.tsx'))).toBe(true)
      expect(fileExistsSync(joinPath(outputDir, 'utils/helpers.ts'))).toBe(true)
      expect(result.filesCopied).toBe(2)
      expect(result.outputPaths).toEqual(expect.arrayContaining(['components/Button.tsx', 'utils/helpers.ts']))
      expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining('Included 2 file(s)'))
    })
  })

  test('returns 0 when no files match patterns', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const sourceDir = joinPath(tmpDir, 'src')
      const outputDir = joinPath(tmpDir, 'out')
      await mkdir(sourceDir)
      await writeFile(joinPath(sourceDir, 'style.css'), 'content')

      // When
      const result = await copyByPattern(
        {
          sourceDir,
          outputDir,
          patterns: ['**/*.png'],
          ignore: [],
          appDirectory: sourceDir,
          sourceDirConfigValue: '.',
        },
        {stdout: mockStdout},
      )

      // Then
      expect(result.filesCopied).toBe(0)
      expect(result.outputPaths).toEqual([])
      expect(fileExistsSync(outputDir)).toBe(false)
    })
  })

  test('skips file and warns when resolved destination escapes the output directory', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given — an absolute pattern that points outside sourceDir, so the
      // computed destination ends up outside outputDir.
      const sourceDir = joinPath(tmpDir, 'src')
      const outputDir = joinPath(tmpDir, 'out')
      const otherDir = joinPath(tmpDir, 'other')
      await mkdir(sourceDir)
      await mkdir(otherDir)
      await writeFile(joinPath(otherDir, 'evil.js'), 'content')

      // When
      const result = await copyByPattern(
        {
          sourceDir,
          outputDir,
          patterns: [joinPath(otherDir, 'evil.js')],
          ignore: [],
          appDirectory: sourceDir,
          sourceDirConfigValue: '.',
        },
        {stdout: mockStdout},
      )

      // Then
      expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining('skipping'))
      expect(result.filesCopied).toBe(0)
      expect(result.outputPaths).toEqual([])
      expect(fileExistsSync(joinPath(outputDir, 'evil.js'))).toBe(false)
    })
  })

  test('returns 0 without copying when filepath equals computed destPath', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given — file already lives at the exact destination path
      const sourceDir = tmpDir
      const outputDir = tmpDir
      await writeFile(joinPath(tmpDir, 'logo.png'), 'content')

      // When — sourceDir==outputDir so relPath='logo.png' and destPath==filepath
      const result = await copyByPattern(
        {
          sourceDir,
          outputDir,
          patterns: ['*.png'],
          ignore: [],
          appDirectory: sourceDir,
          sourceDirConfigValue: '.',
        },
        {stdout: mockStdout},
      )

      // Then
      expect(result.filesCopied).toBe(0)
      expect(result.outputPaths).toEqual([])
      expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining('Included 0 file(s)'))
    })
  })

  test('calls mkdir(outputDir) before copying when files are matched', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const sourceDir = joinPath(tmpDir, 'src')
      const outputDir = joinPath(tmpDir, 'out/dist')
      await mkdir(sourceDir)
      await writeFile(joinPath(sourceDir, 'app.js'), 'content')

      // When
      await copyByPattern(
        {
          sourceDir,
          outputDir,
          patterns: ['*.js'],
          ignore: [],
          appDirectory: sourceDir,
          sourceDirConfigValue: '.',
        },
        {stdout: mockStdout},
      )

      // Then
      expect(fileExistsSync(outputDir)).toBe(true)
      expect(fileExistsSync(joinPath(outputDir, 'app.js'))).toBe(true)
    })
  })

  test('passes ignore patterns to glob', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const sourceDir = joinPath(tmpDir, 'src')
      const outputDir = joinPath(tmpDir, 'out')
      await mkdir(sourceDir)
      await writeFile(joinPath(sourceDir, 'app.js'), 'content')
      await writeFile(joinPath(sourceDir, 'app.test.js'), 'content')

      // When
      const result = await copyByPattern(
        {
          sourceDir,
          outputDir,
          patterns: ['**/*'],
          ignore: ['**/*.test.js'],
          appDirectory: sourceDir,
          sourceDirConfigValue: '.',
        },
        {stdout: mockStdout},
      )

      // Then
      expect(result.filesCopied).toBe(1)
      expect(result.outputPaths).toEqual(['app.js'])
      expect(fileExistsSync(joinPath(outputDir, 'app.js'))).toBe(true)
      expect(fileExistsSync(joinPath(outputDir, 'app.test.js'))).toBe(false)
    })
  })
})
