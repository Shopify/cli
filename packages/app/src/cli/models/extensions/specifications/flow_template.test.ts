import spec from './flow_template.js'
import {ExtensionInstance} from '../extension-instance.js'
import {ExtensionBuildOptions} from '../../../services/build/extension.js'
import {describe, expect, test} from 'vitest'
import {inTemporaryDirectory, writeFile, fileExists, mkdir} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {Writable} from 'stream'

describe('flow_template', () => {
  describe('buildConfig', () => {
    test('uses build_steps mode', () => {
      expect(spec.buildConfig.mode).toBe('copy_files')
    })

    test('has a single copy-files step', () => {
      if (spec.buildConfig.mode === 'none') throw new Error('Expected build_steps mode')

      expect(spec.buildConfig.steps).toHaveLength(1)
      expect(spec.buildConfig.steps[0]).toMatchObject({
        id: 'copy-files',
        type: 'copy_files',
        config: {
          strategy: 'pattern',
          definition: {
            source: '.',
            patterns: expect.arrayContaining(['**/*.flow', '**/*.json', '**/*.toml']),
          },
        },
      })
    })

    test('only copies flow, json, and toml files — not js or ts files', () => {
      if (spec.buildConfig.mode === 'none') throw new Error('Expected build_steps mode')

      const {definition} = spec.buildConfig.steps[0]!.config as {
        definition: {patterns: string[]}
      }

      expect(definition.patterns).toContain('**/*.flow')
      expect(definition.patterns).toContain('**/*.json')
      expect(definition.patterns).toContain('**/*.toml')
      expect(definition.patterns).not.toContain('**/*.js')
      expect(definition.patterns).not.toContain('**/*.ts')
    })

    test('config is serializable to JSON', () => {
      if (spec.buildConfig.mode === 'none') throw new Error('Expected build_steps mode')

      const serialized = JSON.stringify(spec.buildConfig)
      const deserialized = JSON.parse(serialized)

      expect(deserialized.steps).toHaveLength(1)
      expect(deserialized.steps[0].config.strategy).toBe('pattern')
    })
  })

  describe('build integration', () => {
    test('copies flow, json, and toml files to output directory', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')

        await mkdir(extensionDir)
        await mkdir(outputDir)

        await writeFile(joinPath(extensionDir, 'template.flow'), 'flow-content')
        await writeFile(joinPath(extensionDir, 'config.json'), '{}')
        await writeFile(joinPath(extensionDir, 'shopify.app.toml'), '[extension]')
        await writeFile(joinPath(extensionDir, 'index.js'), 'console.log("ignored")')
        await writeFile(joinPath(extensionDir, 'index.ts'), 'const x = 1')

        const extension = new ExtensionInstance({
          configuration: {name: 'my-flow-template', type: 'flow_template'},
          configurationPath: '',
          directory: extensionDir,

          specification: spec as any,
        })
        extension.outputPath = outputDir

        const buildOptions: ExtensionBuildOptions = {
          stdout: new Writable({
            write(chunk, enc, cb) {
              cb()
            },
          }),
          stderr: new Writable({
            write(chunk, enc, cb) {
              cb()
            },
          }),
          app: {} as any,
          environment: 'production',
        }

        // When
        await extension.build(buildOptions)

        // Then — only matching extensions are copied
        await expect(fileExists(joinPath(outputDir, 'template.flow'))).resolves.toBe(true)
        await expect(fileExists(joinPath(outputDir, 'config.json'))).resolves.toBe(true)
        await expect(fileExists(joinPath(outputDir, 'shopify.app.toml'))).resolves.toBe(true)
        await expect(fileExists(joinPath(outputDir, 'index.js'))).resolves.toBe(false)
        await expect(fileExists(joinPath(outputDir, 'index.ts'))).resolves.toBe(false)
      })
    })

    test('preserves subdirectory structure when copying', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        const subDir = joinPath(extensionDir, 'sub')

        await mkdir(extensionDir)
        await mkdir(subDir)
        await mkdir(outputDir)

        await writeFile(joinPath(subDir, 'nested.flow'), 'nested-flow-content')

        const extension = new ExtensionInstance({
          configuration: {name: 'my-flow-template', type: 'flow_template'},
          configurationPath: '',
          directory: extensionDir,

          specification: spec as any,
        })
        extension.outputPath = outputDir

        const buildOptions: ExtensionBuildOptions = {
          stdout: new Writable({
            write(chunk, enc, cb) {
              cb()
            },
          }),
          stderr: new Writable({
            write(chunk, enc, cb) {
              cb()
            },
          }),
          app: {} as any,
          environment: 'production',
        }

        // When
        await extension.build(buildOptions)

        // Then — subdirectory structure is preserved
        await expect(fileExists(joinPath(outputDir, 'sub', 'nested.flow'))).resolves.toBe(true)
      })
    })
  })
})
