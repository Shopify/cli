import {copyConfigKeyEntry} from './copy-config-key-entry.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import * as fs from '@shopify/cli-kit/node/fs'

vi.mock('@shopify/cli-kit/node/fs')

const makeContext = (configuration: Record<string, unknown>) => ({
  extension: {configuration} as any,
  options: {} as any,
  stepResults: new Map(),
})

describe('copyConfigKeyEntry', () => {
  let mockStdout: any

  beforeEach(() => {
    mockStdout = {write: vi.fn()}
  })

  test('merges directory contents into output root by default (preserveStructure false)', async () => {
    // Given
    const context = makeContext({static_root: 'public'})
    vi.mocked(fs.fileExists).mockResolvedValue(true)
    vi.mocked(fs.isDirectory).mockResolvedValue(true)
    vi.mocked(fs.copyDirectoryContents).mockResolvedValue()
    vi.mocked(fs.glob).mockResolvedValue(['index.html', 'logo.png'])

    // When
    const result = await copyConfigKeyEntry(
      {key: 'static_root', baseDir: '/ext', outputDir: '/out', context, preserveStructure: false},
      {stdout: mockStdout},
    )

    // Then
    expect(fs.copyDirectoryContents).toHaveBeenCalledWith('/ext/public', '/out')
    expect(result).toBe(2)
    expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining('Copied contents of'))
  })

  test('places directory under its own name when preserveStructure is true', async () => {
    // Given
    const context = makeContext({theme_root: 'theme'})
    vi.mocked(fs.fileExists).mockResolvedValue(true)
    vi.mocked(fs.isDirectory).mockResolvedValue(true)
    vi.mocked(fs.copyDirectoryContents).mockResolvedValue()
    vi.mocked(fs.glob).mockResolvedValue(['style.css', 'layout.liquid'])

    // When
    const result = await copyConfigKeyEntry(
      {key: 'theme_root', baseDir: '/ext', outputDir: '/out', context, preserveStructure: true},
      {stdout: mockStdout},
    )

    // Then
    expect(fs.copyDirectoryContents).toHaveBeenCalledWith('/ext/theme', '/out/theme')
    expect(result).toBe(2)
    expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining("Copied 'theme' to theme"))
  })

  test('copies a file source to outputDir/basename', async () => {
    // Given
    const context = makeContext({schema_path: 'src/schema.json'})
    vi.mocked(fs.fileExists).mockResolvedValue(true)
    vi.mocked(fs.isDirectory).mockResolvedValue(false)
    vi.mocked(fs.mkdir).mockResolvedValue()
    vi.mocked(fs.copyFile).mockResolvedValue()

    // When
    const result = await copyConfigKeyEntry(
      {key: 'schema_path', baseDir: '/ext', outputDir: '/out', context, preserveStructure: false},
      {stdout: mockStdout},
    )

    // Then
    expect(fs.copyFile).toHaveBeenCalledWith('/ext/src/schema.json', '/out/schema.json')
    expect(result).toBe(1)
    expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining("Copied 'src/schema.json' to schema.json"))
  })

  test('skips with log message when configKey is absent from configuration', async () => {
    // Given
    const context = makeContext({})

    // When
    const result = await copyConfigKeyEntry(
      {key: 'static_root', baseDir: '/ext', outputDir: '/out', context, preserveStructure: false},
      {stdout: mockStdout},
    )

    // Then
    expect(result).toBe(0)
    expect(fs.fileExists).not.toHaveBeenCalled()
    expect(mockStdout.write).toHaveBeenCalledWith("No value for configKey 'static_root', skipping\n")
  })

  test('skips with warning when path resolved from config does not exist on disk', async () => {
    // Given
    const context = makeContext({assets_dir: 'nonexistent'})
    vi.mocked(fs.fileExists).mockResolvedValue(false)

    // When
    const result = await copyConfigKeyEntry(
      {key: 'assets_dir', baseDir: '/ext', outputDir: '/out', context, preserveStructure: false},
      {stdout: mockStdout},
    )

    // Then
    expect(result).toBe(0)
    expect(fs.copyDirectoryContents).not.toHaveBeenCalled()
    expect(mockStdout.write).toHaveBeenCalledWith(
      expect.stringContaining("Warning: path 'nonexistent' does not exist"),
    )
  })

  test('resolves array config value and copies each path, summing results', async () => {
    // Given
    const context = makeContext({roots: ['public', 'assets']})
    vi.mocked(fs.fileExists).mockResolvedValue(true)
    vi.mocked(fs.isDirectory).mockResolvedValue(true)
    vi.mocked(fs.copyDirectoryContents).mockResolvedValue()
    // Each directory listing returns 2 files
    vi.mocked(fs.glob).mockResolvedValue(['a.html', 'b.html'])

    // When
    const result = await copyConfigKeyEntry(
      {key: 'roots', baseDir: '/ext', outputDir: '/out', context, preserveStructure: false},
      {stdout: mockStdout},
    )

    // Then
    expect(fs.copyDirectoryContents).toHaveBeenCalledWith('/ext/public', '/out')
    expect(fs.copyDirectoryContents).toHaveBeenCalledWith('/ext/assets', '/out')
    expect(result).toBe(4)
  })

  test('prefixes outputDir with destination when destination param is provided', async () => {
    // Given
    const context = makeContext({icons_dir: 'icons'})
    vi.mocked(fs.fileExists).mockResolvedValue(true)
    vi.mocked(fs.isDirectory).mockResolvedValue(true)
    vi.mocked(fs.copyDirectoryContents).mockResolvedValue()
    vi.mocked(fs.glob).mockResolvedValue(['icon.svg'])

    // When
    await copyConfigKeyEntry(
      {key: 'icons_dir', baseDir: '/ext', outputDir: '/out', context, preserveStructure: false, destination: 'static/icons'},
      {stdout: mockStdout},
    )

    // Then — effectiveOutputDir is /out/static/icons
    expect(fs.copyDirectoryContents).toHaveBeenCalledWith('/ext/icons', '/out/static/icons')
  })

  test('resolves nested [] flatten path and collects all leaf values', async () => {
    // Given — extensions[].targeting[].schema pattern
    const context = makeContext({
      extensions: [
        {targeting: [{schema: 'schema-a.json'}, {schema: 'schema-b.json'}]},
        {targeting: [{schema: 'schema-c.json'}]},
      ],
    })
    vi.mocked(fs.fileExists).mockResolvedValue(true)
    vi.mocked(fs.isDirectory).mockResolvedValue(false)
    vi.mocked(fs.mkdir).mockResolvedValue()
    vi.mocked(fs.copyFile).mockResolvedValue()

    // When
    const result = await copyConfigKeyEntry(
      {key: 'extensions[].targeting[].schema', baseDir: '/ext', outputDir: '/out', context, preserveStructure: false},
      {stdout: mockStdout},
    )

    // Then — all three schemas copied
    expect(fs.copyFile).toHaveBeenCalledWith('/ext/schema-a.json', '/out/schema-a.json')
    expect(fs.copyFile).toHaveBeenCalledWith('/ext/schema-b.json', '/out/schema-b.json')
    expect(fs.copyFile).toHaveBeenCalledWith('/ext/schema-c.json', '/out/schema-c.json')
    expect(result).toBe(3)
  })

  test('skips with no-value log when [] flatten resolves to a non-array (contract violated)', async () => {
    // Given — extensions is a plain object, not an array, so [] contract fails
    const context = makeContext({
      extensions: {targeting: {schema: 'schema.json'}},
    })

    // When
    const result = await copyConfigKeyEntry(
      {key: 'extensions[].targeting[].schema', baseDir: '/ext', outputDir: '/out', context, preserveStructure: false},
      {stdout: mockStdout},
    )

    // Then — getNestedValue returns undefined, treated as absent key
    expect(result).toBe(0)
    expect(fs.copyDirectoryContents).not.toHaveBeenCalled()
    expect(fs.copyFile).not.toHaveBeenCalled()
    expect(mockStdout.write).toHaveBeenCalledWith(
      expect.stringContaining("No value for configKey 'extensions[].targeting[].schema'"),
    )
  })
})
