import {reloadExtensionConfig, updateExtensionDraft} from './update-extension.js'
import {
  placeholderAppConfiguration,
  testFunctionExtension,
  testDeveloperPlatformClient,
  testPaymentExtensions,
  testThemeExtensions,
  testUIExtension,
} from '../../models/app/app.test-data.js'
import {parseConfigurationFile, parseConfigurationObjectAgainstSpecification} from '../../models/app/loader.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {ExtensionUpdateDraftMutationVariables} from '../../api/graphql/partners/generated/update-draft.js'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {describe, expect, vi, test} from 'vitest'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {platformAndArch} from '@shopify/cli-kit/node/os'
import {randomUUID} from '@shopify/cli-kit/node/crypto'

vi.mock('@shopify/cli-kit/node/crypto')
vi.mock('@shopify/cli-kit/node/output')
vi.mock('../../models/app/loader.js', async () => {
  const actual: any = await vi.importActual('../../models/app/loader.js')
  return {
    ...actual,
    parseConfigurationFile: vi.fn(),
    parseConfigurationObjectAgainstSpecification: vi.fn(),
  }
})

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
      } as any

      const mockExtension = await testUIExtension({
        devUUID: '1',
        configuration,
        directory: tmpDir,
      })

      await mkdir(joinPath(tmpDir, 'mock-handle', 'dist'))
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
      })

      await mkdir(joinPath(tmpDir, mockExtension.handle, 'dist'))
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

      expect(stderr.write).toHaveBeenCalledWith('Error while updating drafts: Error1, Error2')
    })
  })
})

describe('reloadExtensionConfig()', () => {
  const runningOnWindows = platformAndArch().platform === 'windows'

  test.skipIf(runningOnWindows)('reloads extension config', async () => {
    // Given
    await inTemporaryDirectory(async (tmpDir) => {
      const configurationToml = `name = "test"
type = "web_pixel_extension"
runtime_context = "strict"
[settings]
type = "object"
another = "setting"
`

      const parsedConfig = {
        type: 'web_pixel_extension',
        runtime_context: 'strict',
        settings: {
          type: 'object',
          another: 'setting',
        },
      }

      const configPath = joinPath(tmpDir, 'shopify.ui.extension.toml')
      await writeFile(configPath, configurationToml)

      const configuration = {
        runtime_context: 'strict',
        settings: {type: 'object'},
        type: 'web_pixel_extension',
        handle,
      } as any

      const mockExtension = await testUIExtension({
        devUUID: '1',
        configuration,
        directory: tmpDir,
      })

      await mkdir(joinPath(tmpDir, 'dist'))

      vi.mocked(parseConfigurationFile).mockResolvedValue({
        type: 'web_pixel_extension',
      } as any)

      vi.mocked(parseConfigurationObjectAgainstSpecification).mockResolvedValue(parsedConfig)

      await writeFile(mockExtension.outputPath, 'test content')

      // When
      const result = await reloadExtensionConfig({extension: mockExtension, stdout})

      // Then
      expect(mockExtension.configuration).toEqual(parsedConfig)
      expect(result.newConfig).toEqual(parsedConfig)
      expect(result.previousConfig).toEqual(configuration)
    })
  })
})
