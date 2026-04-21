import {executeBundleUIStep} from './bundle-ui-step.js'
import * as buildExtension from '../extension.js'
import {BundleUIStep, BuildContext} from '../client-steps.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import * as fs from '@shopify/cli-kit/node/fs'

vi.mock('@shopify/cli-kit/node/fs')
vi.mock('../extension.js')

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

  test('skips the copy when local and bundle output directories are identical', async () => {
    // Given
    vi.mocked(buildExtension.buildUIExtension).mockResolvedValue('/test/extension/dist/handle.js')

    // When
    await executeBundleUIStep(step, mockContext)

    // Then — fs-extra would throw "Source and destination must not be the same"
    expect(fs.copyFile).not.toHaveBeenCalled()
  })

  test('copies when local and bundle output directories differ', async () => {
    // Given
    mockContext.extension.outputPath = '/bundle/handle/handle.js'
    vi.mocked(buildExtension.buildUIExtension).mockResolvedValue('/test/extension/dist/handle.js')

    // When
    await executeBundleUIStep(step, mockContext)

    // Then
    expect(fs.copyFile).toHaveBeenCalledWith('/test/extension/dist', '/bundle/handle')
  })
})
