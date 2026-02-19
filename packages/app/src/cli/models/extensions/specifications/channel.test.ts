import spec from './channel.js'
import {ExtensionInstance} from '../extension-instance.js'
import {ExtensionBuildOptions} from '../../../services/build/extension.js'
import {describe, expect, test} from 'vitest'
import {inTemporaryDirectory, writeFile, fileExists, mkdir} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {Writable} from 'stream'

const SUBDIRECTORY = 'specifications'

describe('channel_config', () => {
  describe('clientSteps', () => {
    test('uses copy_files mode', () => {
      expect(spec.buildConfig.mode).toBe('copy_files')
    })

    test('has a single copy-files step scoped to the specifications subdirectory', () => {
      expect(spec.clientSteps[0]!.steps).toHaveLength(1)
      expect(spec.clientSteps[0]!.steps[0]).toMatchObject({
        id: 'copy-files',
        type: 'include_assets',
        config: {
          inclusions: [{type: 'pattern', baseDir: SUBDIRECTORY, destination: SUBDIRECTORY}],
        },
      })

      const {include} = (spec.clientSteps[0]!.steps[0]!.config as {inclusions: [{include: string[]}]}).inclusions[0]

      expect(include).toEqual(expect.arrayContaining(['**/*.json', '**/*.toml', '**/*.yaml', '**/*.yml', '**/*.svg']))
    })

    test('config is serializable to JSON', () => {
      const serialized = JSON.stringify(spec.clientSteps)
      const deserialized = JSON.parse(serialized)

      expect(deserialized[0].steps).toHaveLength(1)
      expect(deserialized[0].steps[0].config.inclusions[0].type).toBe('pattern')
    })
  })

  describe('build integration', () => {
    test('copies specification files to output, preserving subdirectory structure', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const extensionDir = joinPath(tmpDir, 'extension')
        const specsDir = joinPath(extensionDir, SUBDIRECTORY)
        const outputDir = joinPath(tmpDir, 'output')

        await mkdir(specsDir)
        await mkdir(outputDir)

        await writeFile(joinPath(specsDir, 'product.json'), '{}')
        await writeFile(joinPath(specsDir, 'order.toml'), '[spec]')
        await writeFile(joinPath(specsDir, 'logo.svg'), '<svg/>')
        // Root-level files should NOT be copied
        await writeFile(joinPath(extensionDir, 'README.md'), '# readme')
        await writeFile(joinPath(extensionDir, 'index.js'), 'ignored')

        const extension = new ExtensionInstance({
          configuration: {name: 'my-channel', type: 'channel'},
          configurationPath: '',
          directory: extensionDir,
          specification: spec,
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

        // Then — specification files copied with path preserved
        await expect(fileExists(joinPath(outputDir, SUBDIRECTORY, 'product.json'))).resolves.toBe(true)
        await expect(fileExists(joinPath(outputDir, SUBDIRECTORY, 'order.toml'))).resolves.toBe(true)
        await expect(fileExists(joinPath(outputDir, SUBDIRECTORY, 'logo.svg'))).resolves.toBe(true)

        // Root-level files not in specifications/ are not copied
        await expect(fileExists(joinPath(outputDir, 'README.md'))).resolves.toBe(false)
        await expect(fileExists(joinPath(outputDir, 'index.js'))).resolves.toBe(false)
      })
    })

    test('does not copy files with non-matching extensions inside specifications/', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const extensionDir = joinPath(tmpDir, 'extension')
        const specsDir = joinPath(extensionDir, SUBDIRECTORY)
        const outputDir = joinPath(tmpDir, 'output')

        await mkdir(specsDir)
        await mkdir(outputDir)

        await writeFile(joinPath(specsDir, 'spec.json'), '{}')
        await writeFile(joinPath(specsDir, 'ignored.ts'), 'const x = 1')
        await writeFile(joinPath(specsDir, 'ignored.js'), 'const x = 1')

        const extension = new ExtensionInstance({
          configuration: {name: 'my-channel', type: 'channel'},
          configurationPath: '',
          directory: extensionDir,
          specification: spec,
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

        // Then
        await expect(fileExists(joinPath(outputDir, SUBDIRECTORY, 'spec.json'))).resolves.toBe(true)
        await expect(fileExists(joinPath(outputDir, SUBDIRECTORY, 'ignored.ts'))).resolves.toBe(false)
        await expect(fileExists(joinPath(outputDir, SUBDIRECTORY, 'ignored.js'))).resolves.toBe(false)
      })
    })
  })
})
