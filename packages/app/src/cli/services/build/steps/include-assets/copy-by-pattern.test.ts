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
    expect(result).toBe(2)
    expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining('Included 2 file(s)'))
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
    expect(result).toBe(0)
    expect(fs.mkdir).not.toHaveBeenCalled()
    expect(fs.copyFile).not.toHaveBeenCalled()
    expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining('no files matched'))
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
    expect(result).toBe(0)
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
    expect(result).toBe(0)
    expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining('Included 0 file(s)'))
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
