import {updateExtensionConfig, updateExtensionDraft} from './update-extension.js'
import {ExtensionUpdateDraftMutation} from '../../api/graphql/update_draft.js'
import {testAppAccessModule, testUIExtension} from '../../models/app/app.test-data.js'
import {parseConfigurationFile, parseConfigurationObject} from '../../models/app/loader.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {describe, expect, vi, test} from 'vitest'
import {joinPath} from '@shopify/cli-kit/node/path'

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

describe('updateExtensionConfig()', () => {
  test('updates draft with new config', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const configurationToml = `name = "test"
type = "web_pixel_extension"
runtime_context = "strict"
[settings]
type = "object"
another = "setting"
`
      await writeFile(joinPath(tmpDir, 'shopify.ui.extension.toml'), configurationToml)

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

      vi.mocked(parseConfigurationObject).mockResolvedValue({
        type: 'web_pixel_extension',
        runtime_context: 'strict',
        settings: {
          type: 'object',
          another: 'setting',
        },
      })

      await writeFile(mockExtension.outputPath, 'test content')

      await updateExtensionConfig({
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
          '{"runtime_context":"strict","runtime_configuration_definition":{"type":"object","another":"setting"},"serialized_script":"dGVzdCBjb250ZW50"}',
      })

      // Check if outputDebug is called with success message
      expect(outputInfo).toHaveBeenCalledWith(
        `Draft updated successfully for extension: ${mockExtension.localIdentifier}`,
        stdout,
      )
    })
  })

  test('updates draft with config for offline api_access mode using dotted keys', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const configurationToml = `[access.api_access]
      mode = "offline"
      `
      const path = joinPath(tmpDir, 'shopify.app.my-app.toml')
      const mode = 'offline' as 'offline'
      const config = {access: {api_access: {mode}}}

      await writeFile(path, configurationToml)

      const mockExtension = await testAppAccessModule(config, path, tmpDir)

      vi.mocked(partnersRequest).mockResolvedValue({
        extensionUpdateDraft: {
          userErrors: [],
        },
      })

      vi.mocked(parseConfigurationObject).mockResolvedValue({type: 'app_access', ...config})

      const options = {extension: mockExtension, token, apiKey, registrationId, stdout, stderr}
      await updateExtensionConfig(options)

      expect(partnersRequest).toHaveBeenCalledWith(ExtensionUpdateDraftMutation, token, {
        apiKey,
        context: undefined,
        registrationId,
        config: '{"access":{"api_access":{"mode":"offline"}}}',
        handle: '',
      })

      // Check if outputDebug is called with success message
      expect(outputInfo).toHaveBeenCalledWith(`Draft config updated successfully for: ${mockExtension.name}`, stdout)
    })
  })

  test('updates draft with config for offline api_access mode using inline table', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const configurationToml = `[access]
      api_access = {mode = "offline"}
      `
      const path = joinPath(tmpDir, 'shopify.app.my-app.toml')
      const mode = 'offline' as 'offline'
      const config = {access: {api_access: {mode}}}

      await writeFile(path, configurationToml)

      const mockExtension = await testAppAccessModule(config, path, tmpDir)

      vi.mocked(partnersRequest).mockResolvedValue({
        extensionUpdateDraft: {
          userErrors: [],
        },
      })

      vi.mocked(parseConfigurationObject).mockResolvedValue({type: 'app_access', ...config})

      const options = {extension: mockExtension, token, apiKey, registrationId, stdout, stderr}
      await updateExtensionConfig(options)

      expect(partnersRequest).toHaveBeenCalledWith(ExtensionUpdateDraftMutation, token, {
        apiKey,
        context: undefined,
        registrationId,
        config: '{"access":{"api_access":{"mode":"offline"}}}',
        handle: '',
      })

      // Check if outputDebug is called with success message
      expect(outputInfo).toHaveBeenCalledWith(`Draft config updated successfully for: ${mockExtension.name}`, stdout)
    })
  })

  test('updates draft with config for online api_access mode using dotted keys', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const configurationToml = `[access.api_access]
      mode = "online"
      `
      const path = joinPath(tmpDir, 'shopify.app.my-app.toml')
      const mode = 'online' as 'online'
      const config = {access: {api_access: {mode}}}

      await writeFile(path, configurationToml)

      const mockExtension = await testAppAccessModule(config, path, tmpDir)

      vi.mocked(partnersRequest).mockResolvedValue({
        extensionUpdateDraft: {
          userErrors: [],
        },
      })

      vi.mocked(parseConfigurationObject).mockResolvedValue({type: 'app_access', ...config})

      const options = {extension: mockExtension, token, apiKey, registrationId, stdout, stderr}
      await updateExtensionConfig(options)

      expect(partnersRequest).toHaveBeenCalledWith(ExtensionUpdateDraftMutation, token, {
        apiKey,
        context: undefined,
        registrationId,
        config: '{"access":{"api_access":{"mode":"online"}}}',
        handle: '',
      })

      // Check if outputDebug is called with success message
      expect(outputInfo).toHaveBeenCalledWith(`Draft config updated successfully for: ${mockExtension.name}`, stdout)
    })
  })

  test('updates draft with config for online api_access mode using inline table', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const configurationToml = `[access]
      api_access = {mode = "online"}
      `
      const path = joinPath(tmpDir, 'shopify.app.my-app.toml')
      const mode = 'online' as 'online'
      const config = {access: {api_access: {mode}}}

      await writeFile(path, configurationToml)

      const mockExtension = await testAppAccessModule(config, path, tmpDir)

      vi.mocked(partnersRequest).mockResolvedValue({
        extensionUpdateDraft: {
          userErrors: [],
        },
      })

      vi.mocked(parseConfigurationObject).mockResolvedValue({type: 'app_access', ...config})

      const options = {extension: mockExtension, token, apiKey, registrationId, stdout, stderr}
      await updateExtensionConfig(options)

      expect(partnersRequest).toHaveBeenCalledWith(ExtensionUpdateDraftMutation, token, {
        apiKey,
        context: undefined,
        registrationId,
        config: '{"access":{"api_access":{"mode":"online"}}}',
        handle: '',
      })

      // Check if outputDebug is called with success message
      expect(outputInfo).toHaveBeenCalledWith(`Draft config updated successfully for: ${mockExtension.name}`, stdout)
    })
  })

  test('updates draft with config for online api_access mode using boolean', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const configurationToml = `[access]
      api_access = true
      `
      const path = joinPath(tmpDir, 'shopify.app.my-app.toml')
      const config = {access: {api_access: true as true}}

      await writeFile(path, configurationToml)

      const mockExtension = await testAppAccessModule(config, path, tmpDir)

      vi.mocked(partnersRequest).mockResolvedValue({
        extensionUpdateDraft: {
          userErrors: [],
        },
      })

      vi.mocked(parseConfigurationObject).mockResolvedValue({type: 'app_access', ...config})

      const options = {extension: mockExtension, token, apiKey, registrationId, stdout, stderr}
      await updateExtensionConfig(options)

      expect(partnersRequest).toHaveBeenCalledWith(ExtensionUpdateDraftMutation, token, {
        apiKey,
        context: undefined,
        registrationId,
        config: '{"access":{"api_access":true}}',
        handle: '',
      })

      // Check if outputDebug is called with success message
      expect(outputInfo).toHaveBeenCalledWith(`Draft config updated successfully for: ${mockExtension.name}`, stdout)
    })
  })
})
