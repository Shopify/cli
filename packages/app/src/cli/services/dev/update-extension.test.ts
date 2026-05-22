import {updateExtensionDraft} from './update-extension.js'
import {
  placeholderAppConfiguration,
  testFunctionExtension,
  testDeveloperPlatformClient,
  testPaymentExtensions,
  testThemeExtensions,
  testUIExtension,
} from '../../models/app/app.test-data.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {ExtensionUpdateDraftMutationVariables} from '../../api/graphql/partners/generated/update-draft.js'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {describe, expect, vi, test} from 'vitest'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {randomUUID} from '@shopify/cli-kit/node/crypto'

vi.mock('@shopify/cli-kit/node/crypto')
vi.mock('@shopify/cli-kit/node/output')

const apiKey = 'mock-api-key'
const registrationId = 'mock-registration-id'
const handle = 'mock-handle'
const stdout = {write: vi.fn()} as any
const stderr = {write: vi.fn()} as any

describe('updateExtensionDraft()', () => {
  test('updates draft successfully and outputs debug message', async () => {
    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient()
    await inTemporaryDirectory(async (tmpDir) => {
      const configuration = {
        runtime_context: 'strict',
        settings: {type: 'object'},
        type: 'web_pixel_extension',
        handle,
        uid: 'uid1',
      } as any

      const mockExtension = await testUIExtension({
        devUUID: '1',
        configuration,
        directory: tmpDir,
        uid: 'uid1',
      })

      await mkdir(joinPath(tmpDir, 'uid1', 'dist'))
      const outputPath = mockExtension.getOutputPathForDirectory(tmpDir)
      await writeFile(outputPath, 'test content')

      await updateExtensionDraft({
        extension: mockExtension,
        developerPlatformClient,
        apiKey,
        registrationId,
        stdout,
        stderr,
        appConfiguration: placeholderAppConfiguration,
        bundlePath: tmpDir,
      })

      expect(developerPlatformClient.updateExtension).toHaveBeenCalledWith({
        apiKey,
        context: '',
        handle,
        registrationId,
        config:
          '{"runtime_context":"strict","runtime_configuration_definition":{"type":"object"},"serialized_script":"dGVzdCBjb250ZW50"}',
      })

      // Check if outputDebug is called with success message
      expect(outputInfo).toHaveBeenCalledWith(
        `Draft updated successfully for extension: ${mockExtension.localIdentifier}`,
        stdout,
      )
    })
  })

  test('uses manifest main path for generic UI extension serialized script', async () => {
    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient()
    await inTemporaryDirectory(async (tmpDir) => {
      const target = 'purchase.checkout.block.render'
      const configuration = {
        name: 'test-ui-extension',
        type: 'ui_extension',
        handle,
        uid: 'uid1',
        extension_points: [
          {
            target,
            module: 'src/index.js',
            build_manifest: {
              assets: {
                main: {
                  module: 'src/index.js',
                  filepath: `${handle}.js`,
                },
              },
            },
          },
        ],
      } as any

      const mockExtension = await testUIExtension({
        devUUID: '1',
        configuration,
        directory: tmpDir,
        uid: 'uid1',
      })

      await mkdir(joinPath(tmpDir, 'uid1', 'dist'))
      await writeFile(
        joinPath(tmpDir, 'uid1', 'manifest.json'),
        JSON.stringify({[target]: {main: `dist/${handle}.js`}}),
      )
      await writeFile(joinPath(tmpDir, 'uid1', 'dist', `${handle}.js`), 'manifest content')
      await writeFile(mockExtension.getOutputPathForDirectory(tmpDir), 'fallback content')

      await updateExtensionDraft({
        extension: mockExtension,
        developerPlatformClient,
        apiKey,
        registrationId,
        stdout,
        stderr,
        appConfiguration: placeholderAppConfiguration,
        bundlePath: tmpDir,
      })

      const updateCall = vi.mocked(developerPlatformClient.updateExtension).mock.calls[0]![0]
      const config = JSON.parse(updateCall.config)
      expect(config.serialized_script).toBe(Buffer.from('manifest content').toString('base64'))
    })
  })

  test('falls back to output path when generic UI extension manifest is missing', async () => {
    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient()
    await inTemporaryDirectory(async (tmpDir) => {
      const configuration = {
        name: 'test-ui-extension',
        type: 'ui_extension',
        handle,
        uid: 'uid1',
        extension_points: [
          {
            target: 'purchase.checkout.block.render',
            module: 'src/index.js',
            build_manifest: {
              assets: {
                main: {
                  module: 'src/index.js',
                  filepath: `${handle}.js`,
                },
              },
            },
          },
        ],
      } as any

      const mockExtension = await testUIExtension({
        devUUID: '1',
        configuration,
        directory: tmpDir,
        uid: 'uid1',
      })

      await mkdir(joinPath(tmpDir, 'uid1'))
      await writeFile(mockExtension.getOutputPathForDirectory(tmpDir), 'fallback content')

      await updateExtensionDraft({
        extension: mockExtension,
        developerPlatformClient,
        apiKey,
        registrationId,
        stdout,
        stderr,
        appConfiguration: placeholderAppConfiguration,
        bundlePath: tmpDir,
      })

      const updateCall = vi.mocked(developerPlatformClient.updateExtension).mock.calls[0]![0]
      const config = JSON.parse(updateCall.config)
      expect(config.serialized_script).toBe(Buffer.from('fallback content').toString('base64'))
    })
  })

  test('continues to use output path for checkout UI extension serialized script', async () => {
    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient()
    await inTemporaryDirectory(async (tmpDir) => {
      const target = 'purchase.checkout.block.render'
      const configuration = {
        name: 'test-checkout-extension',
        type: 'checkout_ui_extension',
        handle,
        uid: 'uid1',
        extension_points: [target],
      } as any

      const mockExtension = await testUIExtension({
        devUUID: '1',
        configuration,
        directory: tmpDir,
        uid: 'uid1',
      })

      await mkdir(joinPath(tmpDir, 'uid1', 'dist'))
      await writeFile(
        joinPath(tmpDir, 'uid1', 'manifest.json'),
        JSON.stringify({[target]: {main: `dist/${handle}-from-manifest.js`}}),
      )
      await writeFile(joinPath(tmpDir, 'uid1', 'dist', `${handle}-from-manifest.js`), 'manifest content')
      await writeFile(mockExtension.getOutputPathForDirectory(tmpDir), 'checkout content')

      await updateExtensionDraft({
        extension: mockExtension,
        developerPlatformClient,
        apiKey,
        registrationId,
        stdout,
        stderr,
        appConfiguration: placeholderAppConfiguration,
        bundlePath: tmpDir,
      })

      const updateCall = vi.mocked(developerPlatformClient.updateExtension).mock.calls[0]![0]
      const config = JSON.parse(updateCall.config)
      expect(config.serialized_script).toBe(Buffer.from('checkout content').toString('base64'))
    })
  })

  test('updates draft successfully with context for extension with target', async () => {
    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient()
    const mockExtension = await testPaymentExtensions()

    await updateExtensionDraft({
      extension: mockExtension,
      developerPlatformClient,
      apiKey,
      registrationId,
      stdout,
      stderr,
      appConfiguration: placeholderAppConfiguration,
      bundlePath: 'dir',
    })

    expect(developerPlatformClient.updateExtension).toHaveBeenCalledWith({
      apiKey,
      context: 'payments.offsite.render',
      handle: mockExtension.handle,
      registrationId,
      config: '{}',
    })

    // Check if outputDebug is called with success message
    expect(outputInfo).toHaveBeenCalledWith(
      `Draft updated successfully for extension: ${mockExtension.localIdentifier}`,
      stdout,
    )
  })

  test('updates draft successfully when extension doesnt support esbuild', async () => {
    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient()
    await inTemporaryDirectory(async (tmpDir) => {
      const configuration = {
        production_api_base_url: 'url1',
        benchmark_api_base_url: 'url2',
        type: 'tax_calculation',
        handle,
      } as any

      const mockExtension = await testUIExtension({
        devUUID: '1',
        configuration,
        directory: tmpDir,
      })

      await mkdir(joinPath(tmpDir, 'dist'))

      await updateExtensionDraft({
        extension: mockExtension,
        developerPlatformClient,
        apiKey,
        registrationId,
        stdout,
        stderr,
        appConfiguration: placeholderAppConfiguration,
        bundlePath: tmpDir,
      })

      expect(developerPlatformClient.updateExtension).toHaveBeenCalledWith({
        apiKey,
        context: '',
        handle,
        registrationId,
        config: '{"production_api_base_url":"url1","benchmark_api_base_url":"url2"}',
      })

      // Check if outputDebug is called with success message
      expect(outputInfo).toHaveBeenCalledWith(
        `Draft updated successfully for extension: ${mockExtension.localIdentifier}`,
        stdout,
      )
    })
  })

  test('updates draft successfully for theme app extension', async () => {
    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient()
    await inTemporaryDirectory(async (tmpDir) => {
      const mockExtension = await testThemeExtensions(tmpDir)

      const filepath = 'blocks/block1.liquid'
      const content = 'test content'
      const base64Content = Buffer.from(content).toString('base64')
      await mkdir(joinPath(tmpDir, 'blocks'))
      await writeFile(joinPath(tmpDir, filepath), content)

      await updateExtensionDraft({
        extension: mockExtension,
        developerPlatformClient,
        apiKey,
        registrationId,
        stdout,
        stderr,
        appConfiguration: placeholderAppConfiguration,
        bundlePath: tmpDir,
      })

      expect(developerPlatformClient.updateExtension).toHaveBeenCalledWith({
        apiKey,
        context: '',
        handle: mockExtension.handle,
        registrationId,
        config: JSON.stringify({
          theme_extension: {
            files: {[filepath]: base64Content},
          },
        }),
      })
    })
  })

  test('updates draft successfully for function app extension', async () => {
    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient()
    await inTemporaryDirectory(async (tmpDir) => {
      const mockExtension = await testFunctionExtension({dir: tmpDir})
      const moduleId = 'moduleId'

      vi.mocked(randomUUID).mockReturnValue(moduleId)

      const filepath = 'index.wasm'
      const content = 'test content'
      const base64Content = Buffer.from(content).toString('base64')
      await mkdir(joinPath(mockExtension.directory, 'dist'))
      const outputPath = mockExtension.outputPath
      await mkdir(dirname(outputPath))
      await writeFile(outputPath, content)

      await updateExtensionDraft({
        extension: mockExtension,
        developerPlatformClient,
        apiKey,
        registrationId,
        stdout,
        stderr,
        appConfiguration: placeholderAppConfiguration,
        bundlePath: tmpDir,
      })

      expect(developerPlatformClient.updateExtension).toHaveBeenCalledWith({
        apiKey,
        context: '',
        handle: mockExtension.handle,
        registrationId,
        config: JSON.stringify({
          title: 'test function extension',
          module_id: moduleId,
          description: 'description',
          app_key: 'mock-api-key',
          api_type: 'product_discounts',
          api_version: '2022-07',
          enable_creation_ui: true,
          localization: {},
          uploaded_files: {'dist/index.wasm': base64Content},
        }),
      })
    })
  })

  test('handles user errors with stderr message', async () => {
    const errorResponse = {
      extensionUpdateDraft: {
        clientMutationId: 'client-mutation-id',
        userErrors: [
          {field: ['field'], message: 'Error1'},
          {field: ['field'], message: 'Error2'},
        ],
      },
    }
    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient({
      updateExtension: (_extensionInput: ExtensionUpdateDraftMutationVariables) => Promise.resolve(errorResponse),
    })
    await inTemporaryDirectory(async (tmpDir) => {
      const mockExtension = await testUIExtension({
        devUUID: '1',
        directory: tmpDir,
        type: 'web_pixel_extension',
        uid: 'uid1',
      })

      await mkdir(joinPath(tmpDir, mockExtension.uid, 'dist'))
      const outputPath = mockExtension.getOutputPathForDirectory(tmpDir)
      await writeFile(outputPath, 'test content')

      await updateExtensionDraft({
        extension: mockExtension,
        developerPlatformClient,
        apiKey,
        registrationId,
        stdout,
        stderr,
        appConfiguration: placeholderAppConfiguration,
        bundlePath: tmpDir,
      })

      expect(stderr.write).toHaveBeenCalledWith('Error updating extension draft for test-ui-extension: Error1, Error2')
    })
  })

  test('handles system error with errors array', async () => {
    const systemError = {
      errors: [{message: 'Network error'}, {message: 'Timeout error'}],
    }
    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient({
      updateExtension: (_extensionInput: ExtensionUpdateDraftMutationVariables) => Promise.reject(systemError), // eslint-disable-line @typescript-eslint/prefer-promise-reject-errors -- testing non-Error rejection handling,
    })

    await inTemporaryDirectory(async (tmpDir) => {
      const mockExtension = await testUIExtension({
        devUUID: '1',
        directory: tmpDir,
        type: 'web_pixel_extension',
        uid: 'uid1',
      })

      await mkdir(joinPath(tmpDir, 'uid1', 'dist'))
      const outputPath = mockExtension.getOutputPathForDirectory(tmpDir)
      await writeFile(outputPath, 'test content')

      await updateExtensionDraft({
        extension: mockExtension,
        developerPlatformClient,
        apiKey,
        registrationId,
        stdout,
        stderr,
        appConfiguration: placeholderAppConfiguration,
        bundlePath: tmpDir,
      })

      expect(stderr.write).toHaveBeenCalledWith(
        'Error updating extension draft for test-ui-extension: Network error, Timeout error',
      )
    })
  })

  test('handles system error with message string', async () => {
    const systemError = {message: 'API connection failed'}
    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient({
      updateExtension: (_extensionInput: ExtensionUpdateDraftMutationVariables) => Promise.reject(systemError), // eslint-disable-line @typescript-eslint/prefer-promise-reject-errors -- testing non-Error rejection handling,
    })

    await inTemporaryDirectory(async (tmpDir) => {
      const mockExtension = await testUIExtension({
        devUUID: '1',
        directory: tmpDir,
        type: 'web_pixel_extension',
        uid: 'uid1',
      })

      await mkdir(joinPath(tmpDir, 'uid1', 'dist'))
      const outputPath = mockExtension.getOutputPathForDirectory(tmpDir)
      await writeFile(outputPath, 'test content')

      await updateExtensionDraft({
        extension: mockExtension,
        developerPlatformClient,
        apiKey,
        registrationId,
        stdout,
        stderr,
        appConfiguration: placeholderAppConfiguration,
        bundlePath: tmpDir,
      })

      expect(stderr.write).toHaveBeenCalledWith(
        'Error updating extension draft for test-ui-extension: API connection failed',
      )
    })
  })

  test('handles string error', async () => {
    const systemError = 'Connection timeout'
    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient({
      updateExtension: (_extensionInput: ExtensionUpdateDraftMutationVariables) => Promise.reject(systemError), // eslint-disable-line @typescript-eslint/prefer-promise-reject-errors -- testing non-Error rejection handling,
    })

    await inTemporaryDirectory(async (tmpDir) => {
      const mockExtension = await testUIExtension({
        devUUID: '1',
        directory: tmpDir,
        type: 'web_pixel_extension',
        uid: 'uid1',
      })

      await mkdir(joinPath(tmpDir, 'uid1', 'dist'))
      const outputPath = mockExtension.getOutputPathForDirectory(tmpDir)
      await writeFile(outputPath, 'test content')

      await updateExtensionDraft({
        extension: mockExtension,
        developerPlatformClient,
        apiKey,
        registrationId,
        stdout,
        stderr,
        appConfiguration: placeholderAppConfiguration,
        bundlePath: tmpDir,
      })

      expect(stderr.write).toHaveBeenCalledWith(
        'Error updating extension draft for test-ui-extension: Connection timeout',
      )
    })
  })

  test('handles null/undefined error with fallback message', async () => {
    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient({
      updateExtension: (_extensionInput: ExtensionUpdateDraftMutationVariables) => Promise.reject(null), // eslint-disable-line @typescript-eslint/prefer-promise-reject-errors -- testing null rejection handling,
    })

    await inTemporaryDirectory(async (tmpDir) => {
      const mockExtension = await testUIExtension({
        devUUID: '1',
        directory: tmpDir,
        type: 'web_pixel_extension',
        uid: 'uid1',
      })

      await mkdir(joinPath(tmpDir, 'uid1', 'dist'))
      const outputPath = mockExtension.getOutputPathForDirectory(tmpDir)
      await writeFile(outputPath, 'test content')

      await updateExtensionDraft({
        extension: mockExtension,
        developerPlatformClient,
        apiKey,
        registrationId,
        stdout,
        stderr,
        appConfiguration: placeholderAppConfiguration,
        bundlePath: tmpDir,
      })

      expect(stderr.write).toHaveBeenCalledWith('Error updating extension draft for test-ui-extension: Unknown error')
    })
  })

  test('handles object error without errors or message properties', async () => {
    const systemError = {status: 500, code: 'INTERNAL_ERROR'}
    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient({
      updateExtension: (_extensionInput: ExtensionUpdateDraftMutationVariables) => Promise.reject(systemError), // eslint-disable-line @typescript-eslint/prefer-promise-reject-errors -- testing non-Error rejection handling,
    })

    await inTemporaryDirectory(async (tmpDir) => {
      const mockExtension = await testUIExtension({
        devUUID: '1',
        directory: tmpDir,
        type: 'web_pixel_extension',
        uid: 'uid1',
      })

      await mkdir(joinPath(tmpDir, 'uid1', 'dist'))
      const outputPath = mockExtension.getOutputPathForDirectory(tmpDir)
      await writeFile(outputPath, 'test content')

      await updateExtensionDraft({
        extension: mockExtension,
        developerPlatformClient,
        apiKey,
        registrationId,
        stdout,
        stderr,
        appConfiguration: placeholderAppConfiguration,
        bundlePath: tmpDir,
      })

      expect(stderr.write).toHaveBeenCalledWith('Error updating extension draft for test-ui-extension: Unknown error')
    })
  })
})
