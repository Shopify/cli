import {executeBundleUIStep} from './bundle-ui-step.js'
import * as generateManifest from './include-assets/generate-manifest.js'
import * as buildExtension from '../extension.js'
import {BundleUIStep, BuildContext} from '../client-steps.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {inTemporaryDirectory, mkdir, writeFile, fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'

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
  test('raises a developer-facing error when the build output directory is missing', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const extensionDir = joinPath(tmpDir, 'extension')
      const localOutputDir = joinPath(extensionDir, 'dist')
      const bundleOutputDir = joinPath(tmpDir, 'bundle', 'handle')

      // The extension build emitted nothing, so localOutputDir is never created.
      mockContext.extension.directory = extensionDir
      mockContext.extension.outputPath = joinPath(bundleOutputDir, 'handle.js')
      vi.mocked(buildExtension.buildUIExtension).mockResolvedValue(joinPath(localOutputDir, 'handle.js'))

      // When / Then
      await expect(executeBundleUIStep(step, mockContext)).rejects.toThrowError(AbortError)
    })
  })

  test('names the missing build output path in the error', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const extensionDir = joinPath(tmpDir, 'extension')
      const localOutputDir = joinPath(extensionDir, 'dist')
      const bundleOutputDir = joinPath(tmpDir, 'bundle', 'handle')

      mockContext.extension.directory = extensionDir
      mockContext.extension.outputPath = joinPath(bundleOutputDir, 'handle.js')
      vi.mocked(buildExtension.buildUIExtension).mockResolvedValue(joinPath(localOutputDir, 'handle.js'))

      // When / Then
      await expect(executeBundleUIStep(step, mockContext)).rejects.toThrow(
        `Couldn't find the build output at ${localOutputDir}`,
      )
    })
  })

  describe('admin_link previews', () => {
    const adminLinkStep: BundleUIStep = {
      id: 'bundle-admin-link-preview',
      name: 'Bundle Admin Link Preview',
      type: 'bundle_ui',
      config: {generatesAssetsManifest: true, bundleFolder: 'dist/'},
    }

    test('no-ops for a plain admin link without preview modules', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const extensionDir = joinPath(tmpDir, 'extension')
        mockContext.extension.directory = extensionDir
        mockContext.extension.outputPath = extensionDir
        mockContext.extension.configuration = {
          targeting: [{url: 'https://example.com', target: 'admin.app.intent.link'}],
        } as ExtensionInstance['configuration']

        // When
        await executeBundleUIStep(adminLinkStep, mockContext)

        // Then
        expect(buildExtension.buildUIExtension).not.toHaveBeenCalled()
        expect(generateManifest.createOrUpdateManifestFile).not.toHaveBeenCalled()
      })
    })

    test('writes the preview target manifest entry from the declared module', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const extensionDir = joinPath(tmpDir, 'extension')
        const localOutputDir = joinPath(extensionDir, 'dist')
        const bundleOutputDir = joinPath(tmpDir, 'bundle', 'handle', 'dist')
        await mkdir(localOutputDir)
        await writeFile(joinPath(localOutputDir, 'my-link.js'), 'console.log("preview")')

        mockContext.extension.directory = extensionDir
        mockContext.extension.outputPath = joinPath(tmpDir, 'bundle', 'handle', 'my-link.js')
        ;(mockContext.extension as {outputRelativePath: string}).outputRelativePath = 'my-link.js'
        mockContext.extension.configuration = {
          targeting: [
            {url: 'https://example.com', target: 'admin.app.intent.link'},
            {target: 'admin.app.intent-preview.render', module: './src/preview.jsx'},
          ],
        } as ExtensionInstance['configuration']
        vi.mocked(buildExtension.buildUIExtension).mockResolvedValue(joinPath(localOutputDir, 'my-link.js'))

        // When
        await executeBundleUIStep(adminLinkStep, mockContext)

        // Then
        await expect(fileExists(joinPath(bundleOutputDir, 'my-link.js'))).resolves.toBe(true)
        expect(generateManifest.createOrUpdateManifestFile).toHaveBeenCalledWith(mockContext, {
          'admin.app.intent-preview.render': {main: 'dist/my-link.js'},
        })
      })
    })
  })
})
