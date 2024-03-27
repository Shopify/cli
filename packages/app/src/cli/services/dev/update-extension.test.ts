import {reloadExtensionConfig, updateExtensionDraft} from './update-extension.js'
import {testDeveloperPlatformClient, testPaymentExtensions, testUIExtension} from '../../models/app/app.test-data.js'
import {parseConfigurationFile, parseConfigurationObject} from '../../models/app/loader.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {ExtensionUpdateDraftInput} from '../../api/graphql/update_draft.js'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {describe, expect, vi, test} from 'vitest'
import {joinPath} from '@shopify/cli-kit/node/path'
import {platformAndArch} from '@shopify/cli-kit/node/os'

vi.mock('@shopify/cli-kit/node/output')
vi.mock('../../models/app/loader.js', async () => {
  const actual: any = await vi.importActual('../../models/app/loader.js')
  return {
    ...actual,
    parseConfigurationFile: vi.fn(),
    parseConfigurationObject: vi.fn(),
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

      await mkdir(joinPath(tmpDir, 'dist'))
      await writeFile(mockExtension.outputPath, 'test content')

      await updateExtensionDraft({
        extension: mockExtension,
        developerPlatformClient,
        apiKey,
        registrationId,
        stdout,
        stderr,
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
      updateExtension: (_extensionInput: ExtensionUpdateDraftInput) => Promise.resolve(errorResponse),
    })
    await inTemporaryDirectory(async (tmpDir) => {
      const mockExtension = await testUIExtension({
        devUUID: '1',
        directory: tmpDir,
        type: 'web_pixel_extension',
      })

      await mkdir(joinPath(tmpDir, 'dist'))
      await writeFile(mockExtension.outputPath, 'test content')

      await updateExtensionDraft({
        extension: mockExtension,
        developerPlatformClient,
        apiKey,
        registrationId,
        stdout,
        stderr,
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

      vi.mocked(parseConfigurationObject).mockResolvedValue(parsedConfig)

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
