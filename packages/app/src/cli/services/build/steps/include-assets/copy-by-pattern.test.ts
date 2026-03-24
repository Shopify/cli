import {copyByPattern} from './copy-by-pattern.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import * as fs from '@shopify/cli-kit/node/fs'

vi.mock('@shopify/cli-kit/node/fs')

describe('copyByPattern', () => {
  let mockStdout: any

  beforeEach(() => {
    mockStdout = {write: vi.fn()}
  })

  test('copies matched files preserving relative paths', async () => {
    // Given
    vi.mocked(fs.glob).mockResolvedValue(['/src/components/Button.tsx', '/src/utils/helpers.ts'])
    vi.mocked(fs.mkdir).mockResolvedValue()
    vi.mocked(fs.copyFile).mockResolvedValue()

    // When
    const result = await copyByPattern(
      {
        sourceDir: '/src',
        outputDir: '/out',
        patterns: ['**/*.ts', '**/*.tsx'],
        ignore: [],
      },
      {stdout: mockStdout},
    )

    // Then
    expect(fs.copyFile).toHaveBeenCalledWith('/src/components/Button.tsx', '/out/components/Button.tsx')
    expect(fs.copyFile).toHaveBeenCalledWith('/src/utils/helpers.ts', '/out/utils/helpers.ts')
    expect(result.filesCopied).toBe(2)
    expect(result.outputPaths).toEqual(expect.arrayContaining(['components/Button.tsx', 'utils/helpers.ts']))
    expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining('Copied 2 file(s)'))
  })

  test('flattens files to basename when preserveStructure is false', async () => {
    // Given
    vi.mocked(fs.glob).mockResolvedValue(['/src/components/Button.tsx', '/src/utils/helper.ts'])
    vi.mocked(fs.mkdir).mockResolvedValue()
    vi.mocked(fs.copyFile).mockResolvedValue()

    // When
    const result = await copyByPattern(
      {
        sourceDir: '/src',
        outputDir: '/out',
        patterns: ['**/*'],
        ignore: [],
        preserveStructure: false,
      },
      {stdout: mockStdout},
    )

    // Then
    expect(fs.copyFile).toHaveBeenCalledWith('/src/components/Button.tsx', '/out/Button.tsx')
    expect(fs.copyFile).toHaveBeenCalledWith('/src/utils/helper.ts', '/out/helper.ts')
    expect(result.filesCopied).toBe(2)
    expect(result.outputPaths).toEqual(expect.arrayContaining(['Button.tsx', 'helper.ts']))
  })

  test('warns and lets last-in-array win when flattening produces basename collision', async () => {
    // Given — two files with the same basename in different directories
    vi.mocked(fs.glob).mockResolvedValue(['/src/a/index.js', '/src/b/index.js'])
    vi.mocked(fs.mkdir).mockResolvedValue()
    vi.mocked(fs.copyFile).mockResolvedValue()

    // When
    const result = await copyByPattern(
      {
        sourceDir: '/src',
        outputDir: '/out',
        patterns: ['**/index.js'],
        ignore: [],
        preserveStructure: false,
      },
      {stdout: mockStdout},
    )

    // Then — collision warning emitted, only the last one is copied
    expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining('filename collision detected'))
    expect(fs.copyFile).toHaveBeenCalledTimes(1)
    expect(fs.copyFile).toHaveBeenCalledWith('/src/b/index.js', '/out/index.js')
    expect(result.filesCopied).toBe(1)
    expect(result.outputPaths).toEqual(['index.js'])
  })

  test('warns and returns 0 when no files match patterns', async () => {
    // Given
    vi.mocked(fs.glob).mockResolvedValue([])

    // When
    const result = await copyByPattern(
      {
        sourceDir: '/src',
        outputDir: '/out',
        patterns: ['**/*.png'],
        ignore: [],
      },
      {stdout: mockStdout},
    )

    // Then
    expect(result.filesCopied).toBe(0)
    expect(result.outputPaths).toEqual([])
    expect(fs.mkdir).not.toHaveBeenCalled()
    expect(fs.copyFile).not.toHaveBeenCalled()
  })

  test('skips file and warns when resolved destination escapes the output directory', async () => {
    // Given — sourceDir is /out/sub, so a file from /out/sub/../../evil resolves outside /out/sub
    // Simulate by providing a glob result whose relative path traverses upward
    vi.mocked(fs.glob).mockResolvedValue(['/out/sub/../../evil.js'])
    vi.mocked(fs.mkdir).mockResolvedValue()
    vi.mocked(fs.copyFile).mockResolvedValue()

    // When
    const result = await copyByPattern(
      {
        sourceDir: '/out/sub',
        outputDir: '/out/sub',
        patterns: ['**/*'],
        ignore: [],
      },
      {stdout: mockStdout},
    )

    // Then
    expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining('skipping'))
    expect(fs.copyFile).not.toHaveBeenCalled()
    expect(result.filesCopied).toBe(0)
    expect(result.outputPaths).toEqual([])
  })

  test('returns 0 without copying when filepath equals computed destPath', async () => {
    // Given — file already lives at the exact destination path
    vi.mocked(fs.glob).mockResolvedValue(['/out/logo.png'])
    vi.mocked(fs.mkdir).mockResolvedValue()
    vi.mocked(fs.copyFile).mockResolvedValue()

    // When — sourceDir is /out so relPath=relativePath('/out','/out/logo.png')='logo.png', destPath='/out/logo.png'==filepath
    const result = await copyByPattern(
      {
        sourceDir: '/out',
        outputDir: '/out',
        patterns: ['*.png'],
        ignore: [],
      },
      {stdout: mockStdout},
    )

    // Then
    expect(fs.copyFile).not.toHaveBeenCalled()
    expect(result.filesCopied).toBe(0)
    expect(result.outputPaths).toEqual([])
    expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining('Copied 0 file(s)'))
  })

  test('calls mkdir(outputDir) before copying when files are matched', async () => {
    // Given
    vi.mocked(fs.glob).mockResolvedValue(['/src/app.js'])
    vi.mocked(fs.mkdir).mockResolvedValue()
    vi.mocked(fs.copyFile).mockResolvedValue()

    // When
    await copyByPattern(
      {
        sourceDir: '/src',
        outputDir: '/out/dist',
        patterns: ['*.js'],
        ignore: [],
      },
      {stdout: mockStdout},
    )

    // Then — outputDir created before copying
    expect(fs.mkdir).toHaveBeenCalledWith('/out/dist')
  })

  test('passes ignore patterns to glob', async () => {
    // Given
    vi.mocked(fs.glob).mockResolvedValue([])

    // When
    await copyByPattern(
      {
        sourceDir: '/src',
        outputDir: '/out',
        patterns: ['**/*'],
        ignore: ['**/*.test.ts', 'node_modules/**'],
      },
      {stdout: mockStdout},
    )

    // Then
    expect(fs.glob).toHaveBeenCalledWith(
      ['**/*'],
      expect.objectContaining({ignore: ['**/*.test.ts', 'node_modules/**']}),
    )
  })
})
