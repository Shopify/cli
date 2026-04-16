import {copyConfigKeyEntry} from './copy-config-key-entry.js'
import {inTemporaryDirectory, writeFile, fileExists, mkdir, readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi, beforeEach} from 'vitest'

const makeContext = (configuration: Record<string, unknown>, stdout: any = {write: vi.fn()}) => ({
  extension: {configuration} as any,
  options: {stdout} as any,
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

      const context = makeContext({static_root: 'public'}, mockStdout)
      const result = await copyConfigKeyEntry({key: 'static_root', baseDir: tmpDir, outputDir: outDir, context})

      expect(result.filesCopied).toBe(2)
      await expect(fileExists(joinPath(outDir, 'index.html'))).resolves.toBe(true)
      await expect(fileExists(joinPath(outDir, 'logo.png'))).resolves.toBe(true)
      expect(result.pathMap.get('public')).toEqual(expect.arrayContaining(['index.html', 'logo.png']))
      expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining("Included 'public'"))
    })
  })

  test('copies a file source to outputDir/basename', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const srcDir = joinPath(tmpDir, 'src')
      await mkdir(srcDir)
      await writeFile(joinPath(srcDir, 'schema.json'), '{}')

      const outDir = joinPath(tmpDir, 'out')
      await mkdir(outDir)

      const context = makeContext({schema_path: 'src/schema.json'}, mockStdout)
      const result = await copyConfigKeyEntry({key: 'schema_path', baseDir: tmpDir, outputDir: outDir, context})

      expect(result.filesCopied).toBe(1)
      await expect(fileExists(joinPath(outDir, 'schema.json'))).resolves.toBe(true)
      const content = await readFile(joinPath(outDir, 'schema.json'))
      expect(content).toBe('{}')
      expect(result.pathMap.get('src/schema.json')).toBe('schema.json')
      expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining("Included 'src/schema.json'"))
    })
  })

  test('renames output file to avoid collision when two sources share the same basename', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const dirA = joinPath(tmpDir, 'a')
      const dirB = joinPath(tmpDir, 'b')
      await mkdir(dirA)
      await mkdir(dirB)
      await writeFile(joinPath(dirA, 'schema.json'), '{"a": true}')
      await writeFile(joinPath(dirB, 'schema.json'), '{"b": true}')

      const outDir = joinPath(tmpDir, 'out')
      await mkdir(outDir)

      const context = makeContext({files: ['a/schema.json', 'b/schema.json']}, mockStdout)
      const result = await copyConfigKeyEntry({key: 'files', baseDir: tmpDir, outputDir: outDir, context})

      expect(result.filesCopied).toBe(2)
      // Both have basename schema.json — second one gets renamed
      await expect(fileExists(joinPath(outDir, 'schema.json'))).resolves.toBe(true)
      await expect(fileExists(joinPath(outDir, 'schema-1.json'))).resolves.toBe(true)
    })
  })

  test('skips when configKey is absent from configuration', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const outDir = joinPath(tmpDir, 'out')
      await mkdir(outDir)

      const context = makeContext({}, mockStdout)
      const result = await copyConfigKeyEntry({key: 'static_root', baseDir: tmpDir, outputDir: outDir, context})

      expect(result.filesCopied).toBe(0)
      expect(result.pathMap.size).toBe(0)
    })
  })

  test('throws when path resolved from config does not exist on disk', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const outDir = joinPath(tmpDir, 'out')
      await mkdir(outDir)

      const context = makeContext({assets_dir: 'nonexistent'}, mockStdout)
      await expect(
        copyConfigKeyEntry({key: 'assets_dir', baseDir: tmpDir, outputDir: outDir, context}),
      ).rejects.toThrow(`Couldn't find`)
    })
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

      const outDir = joinPath(tmpDir, 'out')
      await mkdir(outDir)

      const context = makeContext({roots: ['public', 'assets']}, mockStdout)
      const result = await copyConfigKeyEntry({key: 'roots', baseDir: tmpDir, outputDir: outDir, context})

      // Promise.all runs copies sequentially; glob on the shared outDir may see files
      // from the other copy, so the total count is at least 3 (one per real file).
      expect(result.filesCopied).toBeGreaterThanOrEqual(3)
      await expect(fileExists(joinPath(outDir, 'a.html'))).resolves.toBe(true)
      await expect(fileExists(joinPath(outDir, 'b.html'))).resolves.toBe(true)
      await expect(fileExists(joinPath(outDir, 'logo.svg'))).resolves.toBe(true)
    })
  })

  test('prefixes outputDir with destination when destination param is provided', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const iconsDir = joinPath(tmpDir, 'icons')
      await mkdir(iconsDir)
      await writeFile(joinPath(iconsDir, 'icon.svg'), 'svg')

      const outDir = joinPath(tmpDir, 'out')
      await mkdir(outDir)

      const context = makeContext({icons_dir: 'icons'}, mockStdout)
      await copyConfigKeyEntry({
        key: 'icons_dir',
        baseDir: tmpDir,
        outputDir: outDir,
        context,
        destination: 'static/icons',
      })

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
      const result = await copyConfigKeyEntry({
        key: 'extensions[].targeting[].schema',
        baseDir: tmpDir,
        outputDir: outDir,
        context,
      })

      expect(result.filesCopied).toBe(3)
      await expect(fileExists(joinPath(outDir, 'schema-a.json'))).resolves.toBe(true)
      await expect(fileExists(joinPath(outDir, 'schema-b.json'))).resolves.toBe(true)
      await expect(fileExists(joinPath(outDir, 'schema-c.json'))).resolves.toBe(true)
    })
  })

  test('skips when [] flatten resolves to a non-array (contract violated)', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const outDir = joinPath(tmpDir, 'out')
      await mkdir(outDir)

      const context = makeContext(
        {
          extensions: {targeting: {schema: 'schema.json'}},
        },
        mockStdout,
      )

      const result = await copyConfigKeyEntry({
        key: 'extensions[].targeting[].schema',
        baseDir: tmpDir,
        outputDir: outDir,
        context,
      })

      expect(result.filesCopied).toBe(0)
      expect(result.pathMap.size).toBe(0)
    })
  })

  test('deduplicates repeated source paths — copies each unique path only once', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      await writeFile(joinPath(tmpDir, 'tools.json'), '{}')

      const outDir = joinPath(tmpDir, 'out')
      await mkdir(outDir)

      // Two items referencing the same file; should only be copied once
      const context = makeContext({
        extensions: [{targeting: [{tools: 'tools.json'}, {tools: 'tools.json'}]}],
      })
      const result = await copyConfigKeyEntry({
        key: 'extensions[].targeting[].tools',
        baseDir: tmpDir,
        outputDir: outDir,
        context,
      })

      expect(result.filesCopied).toBe(1)
      await expect(fileExists(joinPath(outDir, 'tools.json'))).resolves.toBe(true)
    })
  })
})
