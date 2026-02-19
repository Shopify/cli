import spec from './theme.js'
import {ExtensionInstance} from '../extension-instance.js'
import {ExtensionBuildOptions} from '../../../services/build/extension.js'
import {describe, expect, test, vi} from 'vitest'
import {inTemporaryDirectory, writeFile, fileExists, mkdir} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {Writable} from 'stream'

vi.mock('../../../services/build/theme-check.js', () => ({
  runThemeCheck: vi.fn().mockResolvedValue(''),
}))

describe('theme', () => {
  describe('buildConfig', () => {
    test('uses build_steps mode', () => {
      expect(spec.buildConfig.mode).toBe('theme')
    })

    test('has two steps: build-theme and bundle-theme', () => {
      if (spec.buildConfig.mode === 'none') throw new Error('Expected build_steps mode')

      const {steps} = spec.buildConfig

      expect(steps).toHaveLength(2)
      expect(steps[0]).toMatchObject({id: 'build-theme', type: 'build_theme'})
      expect(steps[1]).toMatchObject({id: 'bundle-theme', type: 'bundle_theme'})
    })

    test('config is serializable to JSON', () => {
      if (spec.buildConfig.mode === 'none') throw new Error('Expected build_steps mode')

      const serialized = JSON.stringify(spec.buildConfig)
      const deserialized = JSON.parse(serialized)

      expect(deserialized.steps).toHaveLength(2)
      expect(deserialized.steps[0].id).toBe('build-theme')
      expect(deserialized.steps[1].id).toBe('bundle-theme')
    })
  })

  describe('build integration', () => {
    test('bundles theme files to output directory preserving subdirectory structure', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        const blocksDir = joinPath(extensionDir, 'blocks')
        const assetsDir = joinPath(extensionDir, 'assets')

        await mkdir(extensionDir)
        await mkdir(outputDir)
        await mkdir(blocksDir)
        await mkdir(assetsDir)

        await writeFile(joinPath(blocksDir, 'main.liquid'), '{% block %}{% endblock %}')
        await writeFile(joinPath(assetsDir, 'style.css'), 'body {}')

        const extension = new ExtensionInstance({
          configuration: {name: 'theme-extension', type: 'theme'},
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

        // Then — theme files are copied with directory structure preserved
        await expect(fileExists(joinPath(outputDir, 'blocks', 'main.liquid'))).resolves.toBe(true)
        await expect(fileExists(joinPath(outputDir, 'assets', 'style.css'))).resolves.toBe(true)
      })
    })

    test('does not copy ignored files (e.g. .DS_Store, .gitkeep)', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const extensionDir = joinPath(tmpDir, 'extension')
        const outputDir = joinPath(tmpDir, 'output')
        const blocksDir = joinPath(extensionDir, 'blocks')

        await mkdir(extensionDir)
        await mkdir(outputDir)
        await mkdir(blocksDir)

        await writeFile(joinPath(blocksDir, 'main.liquid'), '{% block %}{% endblock %}')
        await writeFile(joinPath(blocksDir, '.DS_Store'), 'ignored')
        await writeFile(joinPath(blocksDir, '.gitkeep'), '')

        const extension = new ExtensionInstance({
          configuration: {name: 'theme-extension', type: 'theme'},
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

        // Then — liquid files are copied, ignored files are not
        await expect(fileExists(joinPath(outputDir, 'blocks', 'main.liquid'))).resolves.toBe(true)
        await expect(fileExists(joinPath(outputDir, 'blocks', '.DS_Store'))).resolves.toBe(false)
        await expect(fileExists(joinPath(outputDir, 'blocks', '.gitkeep'))).resolves.toBe(false)
      })
    })
  })
})
