import {copySourceEntry} from './copy-source-entry.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import * as fs from '@shopify/cli-kit/node/fs'

vi.mock('@shopify/cli-kit/node/fs')

describe('copySourceEntry', () => {
  let mockStdout: any

  beforeEach(() => {
    mockStdout = {write: vi.fn()}
  })

  test('throws when source path does not exist', async () => {
    // Given
    vi.mocked(fs.fileExists).mockResolvedValue(false)

    // When / Then
    await expect(
      copySourceEntry(
        {
          source: 'missing/file.js',
          destination: undefined,
          baseDir: '/ext',
          outputDir: '/out',
        },
        {stdout: mockStdout},
      ),
    ).rejects.toThrow('Source does not exist: /ext/missing/file.js')
  })

  test('copies file to explicit destination path', async () => {
    // Given
    vi.mocked(fs.fileExists).mockResolvedValue(true)
    vi.mocked(fs.isDirectory).mockResolvedValue(false)
    vi.mocked(fs.mkdir).mockResolvedValue()
    vi.mocked(fs.copyFile).mockResolvedValue()

    // When
    const result = await copySourceEntry(
      {
        source: 'src/icon.png',
        destination: 'assets/icon.png',
        baseDir: '/ext',
        outputDir: '/out',
      },
      {stdout: mockStdout},
    )

    // Then
    expect(fs.copyFile).toHaveBeenCalledWith('/ext/src/icon.png', '/out/assets/icon.png')
    expect(result.filesCopied).toBe(1)
    expect(result.outputPaths).toEqual(['assets/icon.png'])
    expect(mockStdout.write).toHaveBeenCalledWith('Included src/icon.png\n')
  })

  test('copies directory under its own name when no destination is given', async () => {
    // Given
    vi.mocked(fs.fileExists).mockResolvedValue(true)
    vi.mocked(fs.isDirectory).mockResolvedValue(true)
    vi.mocked(fs.copyDirectoryContents).mockResolvedValue()
    vi.mocked(fs.glob).mockResolvedValue(['index.html', 'logo.png'])

    // When
    const result = await copySourceEntry(
      {source: 'dist', destination: undefined, baseDir: '/ext', outputDir: '/out'},
      {stdout: mockStdout},
    )

    // Then
    expect(fs.copyDirectoryContents).toHaveBeenCalledWith('/ext/dist', '/out/dist')
    expect(result.filesCopied).toBe(2)
    expect(result.outputPaths).toEqual(['dist/index.html', 'dist/logo.png'])
    expect(mockStdout.write).toHaveBeenCalledWith('Included dist\n')
  })

  test('copies file to basename in outputDir when source is a file and no destination given', async () => {
    // Given
    vi.mocked(fs.fileExists).mockResolvedValue(true)
    vi.mocked(fs.isDirectory).mockResolvedValue(false)
    vi.mocked(fs.mkdir).mockResolvedValue()
    vi.mocked(fs.copyFile).mockResolvedValue()

    // When
    const result = await copySourceEntry(
      {source: 'README.md', destination: undefined, baseDir: '/ext', outputDir: '/out'},
      {stdout: mockStdout},
    )

    // Then
    expect(fs.copyFile).toHaveBeenCalledWith('/ext/README.md', '/out/README.md')
    expect(result.filesCopied).toBe(1)
    expect(result.outputPaths).toEqual(['README.md'])
    expect(mockStdout.write).toHaveBeenCalledWith('Included README.md\n')
  })

  test('copies directory to explicit destination path', async () => {
    // Given
    vi.mocked(fs.fileExists).mockResolvedValue(true)
    vi.mocked(fs.isDirectory).mockResolvedValue(true)
    vi.mocked(fs.copyDirectoryContents).mockResolvedValue()
    vi.mocked(fs.glob).mockResolvedValue(['x.js'])

    // When
    const result = await copySourceEntry(
      {source: 'dist', destination: 'vendor/dist', baseDir: '/ext', outputDir: '/out'},
      {stdout: mockStdout},
    )

    // Then
    expect(fs.copyDirectoryContents).toHaveBeenCalledWith('/ext/dist', '/out/vendor/dist')
    expect(result.filesCopied).toBe(1)
    expect(result.outputPaths).toEqual(['vendor/dist/x.js'])
    expect(mockStdout.write).toHaveBeenCalledWith('Included dist\n')
  })

  test('returns count of files discovered in destination directory after directory copy', async () => {
    // Given
    vi.mocked(fs.fileExists).mockResolvedValue(true)
    vi.mocked(fs.isDirectory).mockResolvedValue(true)
    vi.mocked(fs.copyDirectoryContents).mockResolvedValue()
    // Simulate 5 files inside the copied directory
    vi.mocked(fs.glob).mockResolvedValue(['a.js', 'b.js', 'c.js', 'd.js', 'e.js'])

    // When
    const result = await copySourceEntry(
      {source: 'theme', destination: undefined, baseDir: '/ext', outputDir: '/out'},
      {stdout: mockStdout},
    )

    // Then — count comes from glob on destPath, not a constant
    expect(result.filesCopied).toBe(5)
    expect(result.outputPaths).toEqual(['theme/a.js', 'theme/b.js', 'theme/c.js', 'theme/d.js', 'theme/e.js'])
  })

  test('creates parent directories before copying a file', async () => {
    // Given
    vi.mocked(fs.fileExists).mockResolvedValue(true)
    vi.mocked(fs.isDirectory).mockResolvedValue(false)
    vi.mocked(fs.mkdir).mockResolvedValue()
    vi.mocked(fs.copyFile).mockResolvedValue()

    // When
    await copySourceEntry(
      {
        source: 'src/deep/icon.png',
        destination: 'assets/icons/icon.png',
        baseDir: '/ext',
        outputDir: '/out',
      },
      {stdout: mockStdout},
    )

    // Then — parent of destination path created
    expect(fs.mkdir).toHaveBeenCalledWith('/out/assets/icons')
  })
})
