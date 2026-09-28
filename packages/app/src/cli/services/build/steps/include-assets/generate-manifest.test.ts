import {createOrUpdateManifestFile, resolveOutputDir} from './generate-manifest.js'
import {BuildContext} from '../../client-steps.js'
import {ExtensionInstance} from '../../../../models/extensions/extension-instance.js'
import {describe, expect, test, vi} from 'vitest'
import {inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

function buildContextFor(outputPath: string): BuildContext {
  return {
    extension: {outputPath} as ExtensionInstance,
    options: {stdout: {write: vi.fn()}} as unknown as BuildContext['options'],
    stepResults: new Map(),
  } as BuildContext
}

async function readManifest(outputDir: string): Promise<{[key: string]: unknown}> {
  return JSON.parse(await readFile(joinPath(outputDir, 'manifest.json')))
}

describe('resolveOutputDir', () => {
  test('returns the parent directory when the output path is a file', () => {
    expect(resolveOutputDir(joinPath('bundle', 'handle', 'handle.js'))).toBe(joinPath('bundle', 'handle'))
  })

  test('returns the path itself when the output path has no extension', () => {
    expect(resolveOutputDir(joinPath('bundle', 'handle'))).toBe(joinPath('bundle', 'handle'))
  })
})

describe('createOrUpdateManifestFile', () => {
  test('creates the output directory and writes the manifest when none exists', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const outputDir = joinPath(tmpDir, 'dist')

      await createOrUpdateManifestFile(buildContextFor(joinPath(outputDir, 'handle.js')), {files: ['main.js']})

      await expect(readManifest(outputDir)).resolves.toEqual({files: ['main.js']})
    })
  })

  test('merges new fields into an existing entry so several build steps can contribute', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const outputDir = joinPath(tmpDir, 'dist')
      await mkdir(outputDir)
      await writeFile(
        joinPath(outputDir, 'manifest.json'),
        JSON.stringify({assistant: {main: 'main.js'}, files: ['main.js']}),
      )

      await createOrUpdateManifestFile(buildContextFor(outputDir), {assistant: {tools: 'tools.json'}})

      await expect(readManifest(outputDir)).resolves.toEqual({
        assistant: {main: 'main.js', tools: 'tools.json'},
        files: ['main.js'],
      })
    })
  })

  test('replaces an existing entry when either side is not a plain object', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const outputDir = joinPath(tmpDir, 'dist')
      await mkdir(outputDir)
      await writeFile(joinPath(outputDir, 'manifest.json'), JSON.stringify({files: ['stale.js']}))

      await createOrUpdateManifestFile(buildContextFor(outputDir), {files: ['fresh.js']})

      await expect(readManifest(outputDir)).resolves.toEqual({files: ['fresh.js']})
    })
  })

  test('starts fresh when the existing manifest is not valid JSON', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const outputDir = joinPath(tmpDir, 'dist')
      await mkdir(outputDir)
      await writeFile(joinPath(outputDir, 'manifest.json'), 'not json')

      await createOrUpdateManifestFile(buildContextFor(outputDir), {files: ['main.js']})

      await expect(readManifest(outputDir)).resolves.toEqual({files: ['main.js']})
    })
  })
})
