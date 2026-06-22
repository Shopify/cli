import {executeBundleUIStep} from './bundle-ui-step.js'
import * as generateManifest from './include-assets/generate-manifest.js'
import * as buildExtension from '../extension.js'
import {BundleUIStep, BuildContext} from '../client-steps.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {inTemporaryDirectory, mkdir, writeFile, fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

vi.mock('../extension.js')
vi.mock('./include-assets/generate-manifest.js')

describe('executeBundleUIStep', () => {
  let mockContext: BuildContext

  beforeEach(() => {
    mockContext = {
      extension: {
        directory: '/test/extension',
        outputPath: '/test/extension/dist/handle.js',
        configuration: {},
      } as ExtensionInstance,
      options: {
        stdout: {write: vi.fn()} as any,
        stderr: {write: vi.fn()} as any,
        app: {} as any,
        environment: 'production',
      },
      stepResults: new Map(),
    }
  })

  const step: BundleUIStep = {
    id: 'bundle-ui',
    name: 'Bundle UI Extension',
    type: 'bundle_ui',
    config: {generatesAssetsManifest: false},
  }

  test('copies when local and bundle output directories differ', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const extensionDir = joinPath(tmpDir, 'extension')
      const localOutputDir = joinPath(extensionDir, 'dist')
      const bundleDir = joinPath(tmpDir, 'bundle')
      const bundleOutputDir = joinPath(bundleDir, 'handle')

      await mkdir(localOutputDir)
      await writeFile(joinPath(localOutputDir, 'handle.js'), 'console.log("hello")')

      mockContext.extension.directory = extensionDir
      mockContext.extension.outputPath = joinPath(bundleOutputDir, 'handle.js')
      vi.mocked(buildExtension.buildUIExtension).mockResolvedValue(joinPath(localOutputDir, 'handle.js'))

      // When
      await executeBundleUIStep(step, mockContext)

      // Then
      await expect(fileExists(joinPath(bundleOutputDir, 'handle.js'))).resolves.toBe(true)
    })
  })

  test('skips the copy when local and bundle output directories resolve to the same path but differ as strings', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const extensionDir = joinPath(tmpDir, 'extension')
      const localOutputDir = joinPath(extensionDir, 'dist')
      await mkdir(localOutputDir)

      mockContext.extension.directory = extensionDir
      // /test/./extension/dist/handle.js style
      mockContext.extension.outputPath = joinPath(extensionDir, '.', 'dist', 'handle.js')
      vi.mocked(buildExtension.buildUIExtension).mockResolvedValue(joinPath(localOutputDir, 'handle.js'))

      // When
      await executeBundleUIStep(step, mockContext)

      // Then
      // No copy happens, and we can't really "assert" it didn't happen other than it didn't throw
      // and we didn't provide a bundleDir that would have been created.
    })
  })

  test('skips manifest generation when local and bundle output directories resolve to the same path', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const extensionDir = joinPath(tmpDir, 'extension')
      const localOutputDir = joinPath(extensionDir, 'dist')
      await mkdir(localOutputDir)

      const stepWithManifest: BundleUIStep = {
        id: 'bundle-ui',
        name: 'Bundle UI Extension',
        type: 'bundle_ui',
        config: {generatesAssetsManifest: true},
      }
      mockContext.extension.directory = extensionDir
      mockContext.extension.outputPath = joinPath(extensionDir, '.', 'dist', 'handle.js')
      mockContext.extension.configuration = {
        extension_points: [
          {target: 'admin.product-details.action.render', build_manifest: {assets: {main: {filepath: 'main.js'}}}},
        ],
      } as ExtensionInstance['configuration']
      vi.mocked(buildExtension.buildUIExtension).mockResolvedValue(joinPath(localOutputDir, 'handle.js'))

      // When
      await executeBundleUIStep(stepWithManifest, mockContext)

      // Then
      expect(generateManifest.createOrUpdateManifestFile).not.toHaveBeenCalled()
    })
  })

  test('skips production manifest generation when there are no config-driven assets', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const extensionDir = joinPath(tmpDir, 'extension')
      const localOutputDir = joinPath(extensionDir, 'dist')
      const bundleDir = joinPath(tmpDir, 'bundle')
      const bundleOutputDir = joinPath(bundleDir, 'handle', 'dist')

      await mkdir(localOutputDir)
      await writeFile(joinPath(localOutputDir, 'handle.js'), 'console.log("hello")')

      const stepWithManifestGate: BundleUIStep = {
        id: 'bundle-ui',
        name: 'Bundle UI Extension',
        type: 'bundle_ui',
        config: {
          generatesAssetsManifest: true,
          bundleFolder: 'dist/',
          skipAssetsManifestWithoutConfigAssetsInProduction: true,
        },
      }

      mockContext.extension.directory = extensionDir
      mockContext.extension.outputPath = joinPath(bundleDir, 'handle', 'handle.js')
      mockContext.extension.configuration = {
        extension_points: [
          {target: 'admin.product-details.action.render', build_manifest: {assets: {main: {filepath: 'handle.js'}}}},
        ],
      } as ExtensionInstance['configuration']
      vi.mocked(buildExtension.buildUIExtension).mockResolvedValue(joinPath(localOutputDir, 'handle.js'))

      // When
      await executeBundleUIStep(stepWithManifestGate, mockContext)

      // Then
      await expect(fileExists(joinPath(bundleOutputDir, 'handle.js'))).resolves.toBe(true)
      expect(generateManifest.createOrUpdateManifestFile).not.toHaveBeenCalled()
    })
  })

  test('keeps production manifest generation when config-driven assets exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const extensionDir = joinPath(tmpDir, 'extension')
      const localOutputDir = joinPath(extensionDir, 'dist')
      const bundleDir = joinPath(tmpDir, 'bundle')

      await mkdir(localOutputDir)
      await writeFile(joinPath(localOutputDir, 'handle.js'), 'console.log("hello")')

      const stepWithManifestGate: BundleUIStep = {
        id: 'bundle-ui',
        name: 'Bundle UI Extension',
        type: 'bundle_ui',
        config: {
          generatesAssetsManifest: true,
          bundleFolder: 'dist/',
          skipAssetsManifestWithoutConfigAssetsInProduction: true,
        },
      }

      mockContext.extension.directory = extensionDir
      mockContext.extension.outputPath = joinPath(bundleDir, 'handle', 'handle.js')
      mockContext.extension.configuration = {
        extension_points: [
          {
            target: 'admin.product-details.action.render',
            tools: './tools.json',
            build_manifest: {assets: {main: {filepath: 'handle.js'}}},
          },
        ],
      } as ExtensionInstance['configuration']
      vi.mocked(buildExtension.buildUIExtension).mockResolvedValue(joinPath(localOutputDir, 'handle.js'))

      // When
      await executeBundleUIStep(stepWithManifestGate, mockContext)

      // Then
      expect(generateManifest.createOrUpdateManifestFile).toHaveBeenCalledWith(mockContext, {
        'admin.product-details.action.render': {
          main: 'dist/handle.js',
        },
      })
    })
  })

  test('keeps development manifest generation even when there are no config-driven assets', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const extensionDir = joinPath(tmpDir, 'extension')
      const localOutputDir = joinPath(extensionDir, 'dist')
      const bundleDir = joinPath(tmpDir, 'bundle')

      await mkdir(localOutputDir)
      await writeFile(joinPath(localOutputDir, 'handle.js'), 'console.log("hello")')

      const stepWithManifestGate: BundleUIStep = {
        id: 'bundle-ui',
        name: 'Bundle UI Extension',
        type: 'bundle_ui',
        config: {
          generatesAssetsManifest: true,
          bundleFolder: 'dist/',
          skipAssetsManifestWithoutConfigAssetsInProduction: true,
        },
      }

      mockContext.options.environment = 'development'
      mockContext.extension.directory = extensionDir
      mockContext.extension.outputPath = joinPath(bundleDir, 'handle', 'handle.js')
      mockContext.extension.configuration = {
        extension_points: [
          {target: 'admin.product-details.action.render', build_manifest: {assets: {main: {filepath: 'handle.js'}}}},
        ],
      } as ExtensionInstance['configuration']
      vi.mocked(buildExtension.buildUIExtension).mockResolvedValue(joinPath(localOutputDir, 'handle.js'))

      // When
      await executeBundleUIStep(stepWithManifestGate, mockContext)

      // Then
      expect(generateManifest.createOrUpdateManifestFile).toHaveBeenCalledWith(mockContext, {
        'admin.product-details.action.render': {
          main: 'dist/handle.js',
        },
      })
    })
  })
})
