import {executeBundleUIStep} from './bundle-ui-step.js'
import * as generateManifest from './include-assets/generate-manifest.js'
import * as buildExtension from '../extension.js'
import {BundleUIStep, BuildContext} from '../client-steps.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import * as fs from '@shopify/cli-kit/node/fs'

vi.mock('@shopify/cli-kit/node/fs')
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
    // Given
    mockContext.extension.outputPath = '/bundle/handle/handle.js'
    vi.mocked(buildExtension.buildUIExtension).mockResolvedValue('/test/extension/dist/handle.js')

    // When
    await executeBundleUIStep(step, mockContext)

    // Then
    expect(fs.copyFile).toHaveBeenCalledWith('/test/extension/dist', '/bundle/handle')
  })

  test('skips the copy when local and bundle output directories resolve to the same path but differ as strings', async () => {
    mockContext.extension.outputPath = '/test/./extension/dist/handle.js'
    vi.mocked(buildExtension.buildUIExtension).mockResolvedValue('/test/extension/dist/handle.js')

    await executeBundleUIStep(step, mockContext)

    expect(fs.copyFile).not.toHaveBeenCalled()
  })

  test('skips manifest generation when local and bundle output directories resolve to the same path', async () => {
    const stepWithManifest: BundleUIStep = {
      id: 'bundle-ui',
      name: 'Bundle UI Extension',
      type: 'bundle_ui',
      config: {generatesAssetsManifest: true},
    }
    mockContext.extension.outputPath = '/test/./extension/dist/handle.js'
    mockContext.extension.configuration = {
      extension_points: [
        {target: 'admin.product-details.action.render', build_manifest: {assets: {main: {filepath: 'main.js'}}}},
      ],
    } as ExtensionInstance['configuration']
    vi.mocked(buildExtension.buildUIExtension).mockResolvedValue('/test/extension/dist/handle.js')

    await executeBundleUIStep(stepWithManifest, mockContext)

    expect(fs.copyFile).not.toHaveBeenCalled()
    expect(generateManifest.createOrUpdateManifestFile).not.toHaveBeenCalled()
  })
})
