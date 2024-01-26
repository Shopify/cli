import {reloadExtensionConfig, updateExtensionDraft} from './update-extension.js'
import {ExtensionUpdateDraftMutation} from '../../api/graphql/update_draft.js'
import {testUIExtension} from '../../models/app/app.test-data.js'
import {parseConfigurationFile, parseConfigurationObject} from '../../models/app/loader.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {describe, expect, vi, test} from 'vitest'
import {joinPath} from '@shopify/cli-kit/node/path'
import {platformAndArch} from '@shopify/cli-kit/node/os'

vi.mock('@shopify/cli-kit/node/api/partners')
vi.mock('@shopify/cli-kit/node/output')
vi.mock('../../models/app/loader.js', async () => {
  const actual: any = await vi.importActual('../../models/app/loader.js')
  return {
    ...actual,
    parseConfigurationFile: vi.fn(),
    parseConfigurationObject: vi.fn(),
  }
})

const token = 'mock-token'
const apiKey = 'mock-api-key'
const registrationId = 'mock-registration-id'
const handle = 'mock-handle'
const stdout = {write: vi.fn()} as any
const stderr = {write: vi.fn()} as any

describe('updateExtensionDraft()', () => {
  test('updates draft successfully and outputs debug message', async () => {
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

      vi.mocked(partnersRequest).mockResolvedValue({
        extensionUpdateDraft: {
          userErrors: [],
        },
      })

      await writeFile(mockExtension.outputPath, 'test content')

      await updateExtensionDraft({
        extension: mockExtension,
        token,
        apiKey,
        registrationId,
        stdout,
        stderr,
      })

      expect(partnersRequest).toHaveBeenCalledWith(ExtensionUpdateDraftMutation, token, {
        apiKey,
        context: undefined,
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

  test('updates draft successfully when extension doesnt support esbuild', async () => {
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

      vi.mocked(partnersRequest).mockResolvedValue({
        extensionUpdateDraft: {
          userErrors: [],
        },
      })

      await updateExtensionDraft({
        extension: mockExtension,
        token,
        apiKey,
        registrationId,
        stdout,
        stderr,
      })

      expect(partnersRequest).toHaveBeenCalledWith(ExtensionUpdateDraftMutation, token, {
        apiKey,
        context: undefined,
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
    await inTemporaryDirectory(async (tmpDir) => {
      const mockExtension = await testUIExtension({
        devUUID: '1',
        directory: tmpDir,
        type: 'web_pixel_extension',
      })

      await mkdir(joinPath(tmpDir, 'dist'))

      vi.mocked(partnersRequest).mockResolvedValue({
        extensionUpdateDraft: {
          userErrors: [{message: 'Error1'}, {message: 'Error2'}],
        },
      })

      await writeFile(mockExtension.outputPath, 'test content')

      await updateExtensionDraft({
        extension: mockExtension,
        token,
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

      vi.mocked(partnersRequest).mockResolvedValue({
        extensionUpdateDraft: {
          userErrors: [],
        },
      })

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
      expect(result.previousConfig).toEqual({...configuration, path: configPath})
    })
  })
})
