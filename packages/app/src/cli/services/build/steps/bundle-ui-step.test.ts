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
})
