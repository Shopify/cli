import {copyByPattern} from './copy-by-pattern.js'
import {describe, expect, test, vi} from 'vitest'
import {inTemporaryDirectory, mkdir, writeFile, fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

describe('copyByPattern', () => {
  test('copies matched files preserving relative paths', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const sourceDir = joinPath(tmpDir, 'src')
      const outputDir = joinPath(tmpDir, 'out')
      const appDirectory = tmpDir
      await mkdir(sourceDir)
      await writeFile(joinPath(sourceDir, 'Button.tsx'), 'button')
      await mkdir(joinPath(sourceDir, 'utils'))
      await writeFile(joinPath(sourceDir, 'utils', 'helpers.ts'), 'helpers')

      const mockStdout = {write: vi.fn()}

      // When
      const result = await copyByPattern(
        {
          sourceDir,
          outputDir,
          patterns: ['**/*.ts', '**/*.tsx'],
          ignore: [],
          appDirectory,
          sourceDirConfigValue: 'src',
        },
        {stdout: mockStdout as any},
      )

      // Then
      await expect(fileExists(joinPath(outputDir, 'Button.tsx'))).resolves.toBe(true)
      await expect(fileExists(joinPath(outputDir, 'utils/helpers.ts'))).resolves.toBe(true)
      expect(result.filesCopied).toBe(2)
      expect(result.outputPaths).toEqual(expect.arrayContaining(['Button.tsx', 'utils/helpers.ts']))
      expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining('Included 2 file(s)'))
    })
  })

  test('returns 0 when no files match patterns', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const sourceDir = joinPath(tmpDir, 'src')
      const outputDir = joinPath(tmpDir, 'out')
      const appDirectory = tmpDir
      await mkdir(sourceDir)

      const mockStdout = {write: vi.fn()}

      // When
      const result = await copyByPattern(
        {
          sourceDir,
          outputDir,
          patterns: ['**/*.png'],
          ignore: [],
          appDirectory,
          sourceDirConfigValue: 'src',
        },
        {stdout: mockStdout as any},
      )

      // Then
      expect(result.filesCopied).toBe(0)
      expect(result.outputPaths).toEqual([])
      await expect(fileExists(outputDir)).resolves.toBe(false)
    })
  })

  test('skips file and warns when resolved destination escapes the output directory', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const appDirectory = tmpDir
      const sourceDir = joinPath(tmpDir, 'src/sub')
      const outputDir = joinPath(tmpDir, 'out')
      await mkdir(joinPath(tmpDir, 'src'))
      await mkdir(sourceDir)
      // File at tmpDir/src/evil.js, which is ../evil.js relative to sourceDir
      await writeFile(joinPath(tmpDir, 'src/evil.js'), 'evil')

      const mockStdout = {write: vi.fn()}

      // When
      const result = await copyByPattern(
        {
          sourceDir,
          outputDir,
          patterns: ['../evil.js'],
          ignore: [],
          appDirectory,
          sourceDirConfigValue: 'src/sub',
        },
        {stdout: mockStdout as any},
      )

      // Then
      expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining('skipping'))
      expect(result.filesCopied).toBe(0)
      expect(result.outputPaths).toEqual([])
    })
  })

  test('returns 0 without copying when filepath equals computed destPath', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const sourceDir = tmpDir
      const outputDir = tmpDir
      const appDirectory = tmpDir
      await writeFile(joinPath(tmpDir, 'logo.png'), 'logo')

      const mockStdout = {write: vi.fn()}

      // When
      const result = await copyByPattern(
        {
          sourceDir,
          outputDir,
          patterns: ['*.png'],
          ignore: [],
          appDirectory,
          sourceDirConfigValue: '.',
        },
        {stdout: mockStdout as any},
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
      const appDirectory = tmpDir
      await mkdir(sourceDir)
      await writeFile(joinPath(sourceDir, 'app.js'), 'app')

      const mockStdout = {write: vi.fn()}

      // When
      await copyByPattern(
        {
          sourceDir,
          outputDir,
          patterns: ['*.js'],
          ignore: [],
          appDirectory,
          sourceDirConfigValue: 'src',
        },
        {stdout: mockStdout as any},
      )

      // Then
      await expect(fileExists(outputDir)).resolves.toBe(true)
      await expect(fileExists(joinPath(outputDir, 'app.js'))).resolves.toBe(true)
    })
  })

  test('passes ignore patterns to glob', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const sourceDir = joinPath(tmpDir, 'src')
      const outputDir = joinPath(tmpDir, 'out')
      const appDirectory = tmpDir
      await mkdir(sourceDir)
      await writeFile(joinPath(sourceDir, 'app.js'), 'app')
      await writeFile(joinPath(sourceDir, 'app.test.ts'), 'test')

      const mockStdout = {write: vi.fn()}

      // When
      const result = await copyByPattern(
        {
          sourceDir,
          outputDir,
          patterns: ['**/*'],
          ignore: ['**/*.test.ts'],
          appDirectory,
          sourceDirConfigValue: 'src',
        },
        {stdout: mockStdout as any},
      )

      // Then
      expect(result.filesCopied).toBe(1)
      expect(result.outputPaths).toEqual(['app.js'])
      await expect(fileExists(joinPath(outputDir, 'app.js'))).resolves.toBe(true)
      await expect(fileExists(joinPath(outputDir, 'app.test.ts'))).resolves.toBe(false)
    })
  })
})
