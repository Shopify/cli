import {copyConfigKeyEntry} from './copy-config-key-entry.js'
import {inTemporaryDirectory, writeFile, fileExists, mkdir, readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi, beforeEach} from 'vitest'

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

  test('merges directory contents into output root', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const srcDir = joinPath(tmpDir, 'public')
      await mkdir(srcDir)
      await writeFile(joinPath(srcDir, 'index.html'), '<html/>')
      await writeFile(joinPath(srcDir, 'logo.png'), 'png')

      const outDir = joinPath(tmpDir, 'out')
      await mkdir(outDir)

    // Then
    expect(fs.copyDirectoryContents).toHaveBeenCalledWith('/ext/public', '/out')
    expect(result.filesCopied).toBe(2)
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
    expect(result.filesCopied).toBe(2)
    expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining("Copied 'theme' to theme"))
  })

  test('copies a file source to outputDir/basename', async () => {
    // Given
    const context = makeContext({schema_path: 'src/schema.json'})
    // Source file exists; output path is free so findUniqueDestPath resolves on first attempt
    vi.mocked(fs.fileExists).mockImplementation(async (p) => String(p) === '/ext/src/schema.json')
    vi.mocked(fs.isDirectory).mockResolvedValue(false)
    vi.mocked(fs.mkdir).mockResolvedValue()
    vi.mocked(fs.copyFile).mockResolvedValue()

      const outDir = joinPath(tmpDir, 'out')
      await mkdir(outDir)

    // Then
    expect(fs.copyFile).toHaveBeenCalledWith('/ext/src/schema.json', '/out/schema.json')
    expect(result.filesCopied).toBe(1)
    expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining("Copied 'src/schema.json' to schema.json"))
  })

  test('skips with log message when configKey is absent from configuration', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const outDir = joinPath(tmpDir, 'out')
      await mkdir(outDir)

      const context = makeContext({})
      const result = await copyConfigKeyEntry(
        {key: 'static_root', baseDir: tmpDir, outputDir: outDir, context},
        {stdout: mockStdout},
      )

    // Then
    expect(result.filesCopied).toBe(0)
    expect(fs.fileExists).not.toHaveBeenCalled()
    expect(mockStdout.write).toHaveBeenCalledWith("No value for configKey 'static_root', skipping\n")
  })

  test('skips with warning when path resolved from config does not exist on disk', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const outDir = joinPath(tmpDir, 'out')
      await mkdir(outDir)

      // 'nonexistent' directory is NOT created, so fileExists returns false naturally
      const context = makeContext({assets_dir: 'nonexistent'})
      const result = await copyConfigKeyEntry(
        {key: 'assets_dir', baseDir: tmpDir, outputDir: outDir, context},
        {stdout: mockStdout},
      )

    // Then
    expect(result.filesCopied).toBe(0)
    expect(fs.copyDirectoryContents).not.toHaveBeenCalled()
    expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining("Warning: path 'nonexistent' does not exist"))
  })

  test('resolves array config value and copies each path, summing results', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const pubDir = joinPath(tmpDir, 'public')
      await mkdir(pubDir)
      await writeFile(joinPath(pubDir, 'a.html'), 'a')
      await writeFile(joinPath(pubDir, 'b.html'), 'b')

      const assetsDir = joinPath(tmpDir, 'assets')
      await mkdir(assetsDir)
      await writeFile(joinPath(assetsDir, 'logo.svg'), 'svg')

    // Then
    expect(fs.copyDirectoryContents).toHaveBeenCalledWith('/ext/public', '/out')
    expect(fs.copyDirectoryContents).toHaveBeenCalledWith('/ext/assets', '/out')
    expect(result.filesCopied).toBe(4)
  })

  test('prefixes outputDir with destination when destination param is provided', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const iconsDir = joinPath(tmpDir, 'icons')
      await mkdir(iconsDir)
      await writeFile(joinPath(iconsDir, 'icon.svg'), 'svg')

      const outDir = joinPath(tmpDir, 'out')
      await mkdir(outDir)

      const context = makeContext({icons_dir: 'icons'})
      await copyConfigKeyEntry(
        {key: 'icons_dir', baseDir: tmpDir, outputDir: outDir, context, destination: 'static/icons'},
        {stdout: mockStdout},
      )

      await expect(fileExists(joinPath(outDir, 'static', 'icons', 'icon.svg'))).resolves.toBe(true)
    })
  })

  test('resolves nested [] flatten path and collects all leaf values', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      await writeFile(joinPath(tmpDir, 'schema-a.json'), '{}')
      await writeFile(joinPath(tmpDir, 'schema-b.json'), '{}')
      await writeFile(joinPath(tmpDir, 'schema-c.json'), '{}')

      const outDir = joinPath(tmpDir, 'out')
      await mkdir(outDir)

      const context = makeContext({
        extensions: [
          {targeting: [{schema: 'schema-a.json'}, {schema: 'schema-b.json'}]},
          {targeting: [{schema: 'schema-c.json'}]},
        ],
      })
      const result = await copyConfigKeyEntry(
        {key: 'extensions[].targeting[].schema', baseDir: tmpDir, outputDir: outDir, context},
        {stdout: mockStdout},
      )

      expect(result).toBe(3)
      await expect(fileExists(joinPath(outDir, 'schema-a.json'))).resolves.toBe(true)
      await expect(fileExists(joinPath(outDir, 'schema-b.json'))).resolves.toBe(true)
      await expect(fileExists(joinPath(outDir, 'schema-c.json'))).resolves.toBe(true)
    })
    // Source files exist; output paths are free so findUniqueDestPath resolves on first attempt
    vi.mocked(fs.fileExists).mockImplementation(async (p) => String(p).startsWith('/ext/'))
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
    expect(result.filesCopied).toBe(3)
  })

  test('skips with no-value log when [] flatten resolves to a non-array (contract violated)', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const outDir = joinPath(tmpDir, 'out')
      await mkdir(outDir)

      const context = makeContext({
        extensions: {targeting: {schema: 'schema.json'}},
      })

      const result = await copyConfigKeyEntry(
        {key: 'extensions[].targeting[].schema', baseDir: tmpDir, outputDir: outDir, context},
        {stdout: mockStdout},
      )

      expect(result).toBe(0)
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining("No value for configKey 'extensions[].targeting[].schema'"),
      )
    })

    // When
    const result = await copyConfigKeyEntry(
      {key: 'extensions[].targeting[].schema', baseDir: '/ext', outputDir: '/out', context, preserveStructure: false},
      {stdout: mockStdout},
    )

    // Then — getNestedValue returns undefined, treated as absent key
    expect(result.filesCopied).toBe(0)
    expect(fs.copyDirectoryContents).not.toHaveBeenCalled()
    expect(fs.copyFile).not.toHaveBeenCalled()
    expect(mockStdout.write).toHaveBeenCalledWith(
      expect.stringContaining("No value for configKey 'extensions[].targeting[].schema'"),
    )
  })
})
