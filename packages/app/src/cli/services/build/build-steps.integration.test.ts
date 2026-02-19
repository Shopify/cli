import {ExtensionBuildOptions} from './extension.js'
import {executeStep, BuildContext} from './build-steps.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {describe, expect, test} from 'vitest'
import {inTemporaryDirectory, writeFile, readFile, mkdir, fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {Writable} from 'stream'

function buildOptions(): ExtensionBuildOptions {
  return {
    stdout: new Writable({
      write(chunk, encoding, callback) {
        callback()
      },
    }),
    stderr: new Writable({
      write(chunk, encoding, callback) {
        callback()
      },
    }),
    app: {} as any,
    environment: 'production',
  }
}

describe('build_steps integration', () => {
  test('executes copy_files step and copies files to output', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Setup: Create extension directory with assets
      const extensionDir = joinPath(tmpDir, 'extension')
      const assetsDir = joinPath(extensionDir, 'assets')
      const outputDir = joinPath(tmpDir, 'output')

      await mkdir(extensionDir)
      await mkdir(assetsDir)
      await mkdir(outputDir)

      // Create test files
      await writeFile(joinPath(assetsDir, 'logo.png'), 'fake-png-data')
      await writeFile(joinPath(assetsDir, 'style.css'), 'body { color: red; }')

      const mockExtension = {
        directory: extensionDir,
        outputPath: joinPath(outputDir, 'extension.js'),
      } as ExtensionInstance

      const context: BuildContext = {extension: mockExtension, options: buildOptions(), stepResults: new Map()}

      await executeStep(
        {
          id: 'copy-assets',
          displayName: 'Copy Assets',
          type: 'copy_files',
          config: {
            strategy: 'pattern',
            definition: {source: 'assets', patterns: ['**/*']},
          },
        },
        context,
      )

      // Verify: Files were copied to output directory
      const logoExists = await fileExists(joinPath(outputDir, 'logo.png'))
      const styleExists = await fileExists(joinPath(outputDir, 'style.css'))

      expect(logoExists).toBe(true)
      expect(styleExists).toBe(true)

      const logoContent = await readFile(joinPath(outputDir, 'logo.png'))
      const styleContent = await readFile(joinPath(outputDir, 'style.css'))

      expect(logoContent).toBe('fake-png-data')
      expect(styleContent).toBe('body { color: red; }')
    })
  })

  test('executes multiple steps in sequence', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Setup: Create extension with two asset directories
      const extensionDir = joinPath(tmpDir, 'extension')
      const imagesDir = joinPath(extensionDir, 'images')
      const stylesDir = joinPath(extensionDir, 'styles')
      const outputDir = joinPath(tmpDir, 'output')

      await mkdir(extensionDir)
      await mkdir(imagesDir)
      await mkdir(stylesDir)
      await mkdir(outputDir)

      await writeFile(joinPath(imagesDir, 'logo.png'), 'logo-data')
      await writeFile(joinPath(stylesDir, 'main.css'), 'css-data')

      const mockExtension = {
        directory: extensionDir,
        outputPath: joinPath(outputDir, 'extension.js'),
      } as ExtensionInstance

      const context: BuildContext = {extension: mockExtension, options: buildOptions(), stepResults: new Map()}

      await executeStep(
        {
          id: 'copy-images',
          displayName: 'Copy Images',
          type: 'copy_files',
          config: {
            strategy: 'pattern',
            definition: {source: 'images', patterns: ['**/*'], destination: 'assets/images'},
          },
        },
        context,
      )
      await executeStep(
        {
          id: 'copy-styles',
          displayName: 'Copy Styles',
          type: 'copy_files',
          config: {
            strategy: 'pattern',
            definition: {source: 'styles', patterns: ['**/*'], destination: 'assets/styles'},
          },
        },
        context,
      )

      // Verify: Files from both steps were copied to correct destinations
      const logoExists = await fileExists(joinPath(outputDir, 'assets/images/logo.png'))
      const styleExists = await fileExists(joinPath(outputDir, 'assets/styles/main.css'))

      expect(logoExists).toBe(true)
      expect(styleExists).toBe(true)
    })
  })

  test('silently skips tomlKeys step when TOML key is absent from extension config', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const extensionDir = joinPath(tmpDir, 'extension')
      const outputDir = joinPath(tmpDir, 'output')

      await mkdir(extensionDir)
      await mkdir(outputDir)

      // Extension has no configuration — static_root key is absent
      const mockExtension = {
        directory: extensionDir,
        outputPath: joinPath(outputDir, 'extension.js'),
        configuration: {},
      } as unknown as ExtensionInstance

      const context: BuildContext = {extension: mockExtension, options: buildOptions(), stepResults: new Map()}

      // Should not throw — absent tomlKeys are silently skipped
      await expect(
        executeStep(
          {
            id: 'copy-static',
            displayName: 'Copy Static Assets',
            type: 'copy_files',
            config: {strategy: 'files', definition: {files: [{tomlKey: 'static_root'}]}},
          },
          context,
        ),
      ).resolves.not.toThrow()
    })
  })
})
