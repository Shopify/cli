import {executeGenerateUIAssetsManifestStep} from './generate-ui-assets-manifest-step.js'
import * as generateManifest from './include-assets/generate-manifest.js'
import {GenerateUIAssetsManifestStep, BuildContext} from '../client-steps.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'

vi.mock('./include-assets/generate-manifest.js')

const step: GenerateUIAssetsManifestStep = {
  id: 'generate-ui-assets-manifest',
  name: 'Generate UI Assets Manifest',
  type: 'generate_ui_assets_manifest',
  config: {bundleFolder: 'dist/'},
}

describe('executeGenerateUIAssetsManifestStep', () => {
  let mockContext: BuildContext

  beforeEach(() => {
    vi.mocked(generateManifest.createOrUpdateManifestFile).mockResolvedValue()
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

  test('writes manifest entries derived from build_manifest assets, prefixed with bundleFolder', async () => {
    // Given
    mockContext.extension.configuration = {
      extension_points: [
        {
          target: 'admin.product-details.block.render',
          build_manifest: {
            assets: {
              main: {filepath: 'main.js'},
              styles: {filepath: 'main.css'},
            },
          },
        },
      ],
    } as any

    // When
    await executeGenerateUIAssetsManifestStep(step, mockContext)

    // Then
    expect(generateManifest.createOrUpdateManifestFile).toHaveBeenCalledWith(mockContext, {
      'admin.product-details.block.render': {
        main: 'dist/main.js',
        styles: 'dist/main.css',
      },
    })
  })

  test('omits the bundleFolder prefix when not configured', async () => {
    // Given
    const stepWithoutFolder: GenerateUIAssetsManifestStep = {
      id: 'generate-ui-assets-manifest',
      name: 'Generate UI Assets Manifest',
      type: 'generate_ui_assets_manifest',
    }
    mockContext.extension.configuration = {
      extension_points: [
        {
          target: 'admin.x',
          build_manifest: {assets: {main: {filepath: 'main.js'}}},
        },
      ],
    } as any

    // When
    await executeGenerateUIAssetsManifestStep(stepWithoutFolder, mockContext)

    // Then
    expect(generateManifest.createOrUpdateManifestFile).toHaveBeenCalledWith(mockContext, {
      'admin.x': {main: 'main.js'},
    })
  })

  test('does nothing when extension has no extension_points', async () => {
    mockContext.extension.configuration = {} as any

    await executeGenerateUIAssetsManifestStep(step, mockContext)

    expect(generateManifest.createOrUpdateManifestFile).not.toHaveBeenCalled()
  })

  test('does nothing when no extension_point has a build_manifest with assets', async () => {
    mockContext.extension.configuration = {
      extension_points: [{target: 'admin.x'}],
    } as any

    await executeGenerateUIAssetsManifestStep(step, mockContext)

    expect(generateManifest.createOrUpdateManifestFile).not.toHaveBeenCalled()
  })
})
