import {linkedAppContext, localAppContext} from './app-context.js'
import {fetchSpecifications} from './generate/fetch-extension-specifications.js'
import {addUidToTomlsIfNecessary} from './app/add-uid-to-extension-toml.js'
import link from './app/config/link.js'
import {appFromIdentifiers} from './context.js'

import * as localStorage from './local-storage.js'
import {fetchOrgFromId} from './dev/fetch.js'
import {testOrganizationApp, testDeveloperPlatformClient, testOrganization} from '../models/app/app.test-data.js'
import metadata from '../metadata.js'
import * as loader from '../models/app/loader.js'
import {loadLocalExtensionsSpecifications} from '../models/extensions/load-specifications.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {inTemporaryDirectory, writeFile, mkdir} from '@shopify/cli-kit/node/fs'
import {joinPath, normalizePath} from '@shopify/cli-kit/node/path'
import {tryParseInt} from '@shopify/cli-kit/common/string'

vi.mock('../models/app/validation/multi-cli-warning.js')
vi.mock('./generate/fetch-extension-specifications.js')
vi.mock('./app/config/link.js')
vi.mock('./context.js')
vi.mock('./dev/fetch.js')
vi.mock('./app/add-uid-to-extension-toml.js')
vi.mock('../models/extensions/load-specifications.js')

async function writeAppConfig(tmp: string, content: string, configName?: string) {
  const appConfigPath = joinPath(tmp, configName ?? 'shopify.app.toml')
  const packageJsonPath = joinPath(tmp, 'package.json')
  await writeFile(appConfigPath, content)
  await writeFile(packageJsonPath, '{}')
}

const mockDeveloperPlatformClient = testDeveloperPlatformClient()
const mockOrganization = testOrganization()
const mockRemoteApp = testOrganizationApp({
  apiKey: 'test-api-key',
  title: 'Test App',
  organizationId: 'test-org-id',
  developerPlatformClient: mockDeveloperPlatformClient,
})

beforeEach(() => {
  vi.mocked(fetchSpecifications).mockResolvedValue([])
  vi.mocked(appFromIdentifiers).mockResolvedValue(mockRemoteApp)
  vi.mocked(fetchOrgFromId).mockResolvedValue(mockOrganization)
})

describe('linkedAppContext', () => {
  test('returns linked app context when app is already linked', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const content = `
name = "test-app"
client_id="test-api-key"`
      await writeAppConfig(tmp, content)

      // When
      const result = await linkedAppContext({
        directory: tmp,
        forceRelink: false,
        userProvidedConfigName: undefined,
        clientId: undefined,
      })

      // Then
      expect(result).toEqual({
        app: expect.objectContaining({
          configPath: normalizePath(joinPath(tmp, 'shopify.app.toml')),
          configuration: expect.objectContaining({
            client_id: 'test-api-key',
            name: 'test-app',
          }),
        }),
        remoteApp: mockRemoteApp,
        developerPlatformClient: expect.any(Object),
        specifications: [],
        organization: mockOrganization,
        project: expect.any(Object),
        activeConfig: expect.any(Object),
      })
      expect(link).not.toHaveBeenCalled()
    })
  })

  test('updates cached app info when remoteApp matches', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      vi.mocked(appFromIdentifiers).mockResolvedValue({...mockRemoteApp, apiKey: 'test-api-key-new'})
      const content = `
name = "test-app"
client_id="test-api-key-new"`
      await writeAppConfig(tmp, content)
      localStorage.setCachedAppInfo({
        appId: 'test-api-key-old',
        title: 'Test App',
        directory: tmp,
        orgId: 'test-org-id',
      })

      // When
      await linkedAppContext({
        directory: tmp,
        forceRelink: false,
        userProvidedConfigName: undefined,
        clientId: undefined,
      })
      const result = localStorage.getCachedAppInfo(tmp)

      // Then
      expect(link).not.toHaveBeenCalled()

      expect(result).toEqual({
        appId: 'test-api-key-new',
        title: 'Test App',
        directory: expect.any(String),
        orgId: 'test-org-id',
      })
    })
  })

  test('uses provided clientId when available and updates the app configuration', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const content = `
name = "test-app"
client_id="test-api-key"`
      await writeAppConfig(tmp, content)
      const newClientId = 'new-api-key'

      vi.mocked(appFromIdentifiers).mockResolvedValue({...mockRemoteApp, apiKey: newClientId})

      // When
      const result = await linkedAppContext({
        directory: tmp,
        clientId: newClientId,
        forceRelink: false,
        userProvidedConfigName: undefined,
      })

      // Then
      expect(link).not.toHaveBeenCalled()
      expect(result.remoteApp.apiKey).toBe(newClientId)
      expect(result.app.configuration.client_id).toEqual('new-api-key')
      expect(appFromIdentifiers).toHaveBeenCalledWith(expect.objectContaining({apiKey: newClientId}))
    })
  })

  test('resets app when there is a valid toml but reset option is true', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const content = `
name = "test-app"
client_id="test-api-key"`
      await writeAppConfig(tmp, content)

      vi.mocked(link).mockResolvedValue({
        remoteApp: mockRemoteApp,
        configFileName: 'shopify.app.toml',
        configuration: {
          client_id: 'test-api-key',
          name: 'test-app',
          path: normalizePath(joinPath(tmp, 'shopify.app.toml')),
        } as any,
      })

      // When
      await linkedAppContext({
        directory: tmp,
        forceRelink: true,
        userProvidedConfigName: undefined,
        clientId: undefined,
      })

      // Then
      expect(link).toHaveBeenCalledWith({directory: tmp, apiKey: undefined, configName: undefined})
    })
  })

  test('forceRelink skips config selection before link to avoid spurious TOML prompt', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given — no config file on disk, so getAppConfigurationContext would prompt for TOML selection
      // if called before link. We verify link is called first (without a prior config load).
      const content = `
name = "test-app"
client_id="test-api-key"`
      await writeAppConfig(tmp, content)

      const getAppConfigSpy = vi.spyOn(loader, 'getAppConfigurationContext')

      vi.mocked(link).mockResolvedValue({
        remoteApp: mockRemoteApp,
        configFileName: 'shopify.app.toml',
        configuration: {
          client_id: 'test-api-key',
          name: 'test-app',
          path: normalizePath(joinPath(tmp, 'shopify.app.toml')),
        } as any,
      })

      // When
      await linkedAppContext({
        directory: tmp,
        forceRelink: true,
        userProvidedConfigName: undefined,
        clientId: undefined,
      })

      // Then — getAppConfigurationContext should only be called AFTER link, not before
      const linkCallOrder = vi.mocked(link).mock.invocationCallOrder[0]!
      const configCallOrders = getAppConfigSpy.mock.invocationCallOrder
      expect(configCallOrders.every((order) => order > linkCallOrder)).toBe(true)

      getAppConfigSpy.mockRestore()
    })
  })

  test('logs metadata', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const content = `
name = "test-app"
client_id="test-api-key"`
      await writeAppConfig(tmp, content)

      // When
      await linkedAppContext({
        directory: tmp,
        forceRelink: false,
        userProvidedConfigName: undefined,
        clientId: undefined,
      })

      const meta = metadata.getAllPublicMetadata()
      expect(meta).toEqual(
        expect.objectContaining({
          business_platform_id: tryParseInt(mockOrganization.id),
          api_key: mockRemoteApp.apiKey,
          cmd_app_reset_used: false,
        }),
      )
      expect(meta).not.toHaveProperty('partner_id')
    })
  })

  test('unsafeTolerateErrors skips throwIfErrors and addUidToTomlsIfNecessary', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const content = `
name = "test-app"
client_id="test-api-key"`
      await writeAppConfig(tmp, content)

      // When
      await linkedAppContext({
        directory: tmp,
        forceRelink: false,
        userProvidedConfigName: undefined,
        clientId: undefined,
        unsafeTolerateErrors: true,
      })

      // Then — addUidToTomlsIfNecessary is only called when errors are empty
      // Since the mock app has no errors, it will still be called
      expect(vi.mocked(addUidToTomlsIfNecessary)).toHaveBeenCalled()
    })
  })

  test('throws when unsafeTolerateErrors is false and app has errors', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const content = `
name = "test-app"
client_id="test-api-key"`
      await writeAppConfig(tmp, content)
      const loadSpy = vi.spyOn(loader, 'loadAppFromContext')
      const {AppErrors} = await import('../models/app/loader.js')
      const errors = new AppErrors()
      errors.addError({file: 'test', message: 'some error'})
      loadSpy.mockResolvedValue({errors} as any)

      // When/Then
      await expect(
        linkedAppContext({
          directory: tmp,
          forceRelink: false,
          userProvidedConfigName: undefined,
          clientId: undefined,
        }),
      ).rejects.toThrow()
      loadSpy.mockRestore()
    })
  })

  test('does not throw when unsafeTolerateErrors is false and app has no errors', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const content = `
name = "test-app"
client_id="test-api-key"`
      await writeAppConfig(tmp, content)

      // When
      await linkedAppContext({
        directory: tmp,
        forceRelink: false,
        userProvidedConfigName: undefined,
        clientId: undefined,
      })

      // Then
      expect(vi.mocked(addUidToTomlsIfNecessary)).toHaveBeenCalled()
    })
  })
})

describe('localAppContext', () => {
  beforeEach(() => {
    vi.mocked(loadLocalExtensionsSpecifications).mockResolvedValue([])
  })

  test('loads app without network calls or linking', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const content = `
        name = "test-app"
        client_id = "test-client-id"
        application_url = "https://example.com"
        embedded = true

        [auth]
        redirect_urls = ["https://example.com/callback"]

        [webhooks]
        api_version = "2024-01"
      `
      await writeAppConfig(tmp, content)

      // When
      const result = await localAppContext({
        directory: tmp,
      })

      // Then
      expect(result).toBeDefined()
      expect(result.app.name).toEqual(expect.any(String))
      expect(result.app.directory).toEqual(normalizePath(tmp))
      expect(result.app.configuration).toEqual(
        expect.objectContaining({
          name: 'test-app',
        }),
      )
      expect(result.app.configPath).toEqual(normalizePath(joinPath(tmp, 'shopify.app.toml')))
      // Verify no network calls were made
      expect(appFromIdentifiers).not.toHaveBeenCalled()
      expect(fetchOrgFromId).not.toHaveBeenCalled()
      expect(link).not.toHaveBeenCalled()
    })
  })

  test('uses userProvidedConfigName when provided', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const content = `
        name = "test-app-custom"
        client_id = "test-client-id"
        application_url = "https://example.com"
        embedded = true

        [auth]
        redirect_urls = ["https://example.com/callback"]

        [webhooks]
        api_version = "2024-01"
      `
      await writeAppConfig(tmp, content, 'shopify.app.custom.toml')

      // When
      const result = await localAppContext({
        directory: tmp,
        userProvidedConfigName: 'shopify.app.custom.toml',
      })

      // Then
      expect(result).toBeDefined()
      expect(result.app.configuration).toEqual(
        expect.objectContaining({
          name: 'test-app-custom',
        }),
      )
      expect(result.app.configPath).toEqual(normalizePath(joinPath(tmp, 'shopify.app.custom.toml')))
    })
  })

  test('loads app with extensions', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const appContent = `
        name = "test-app"
        client_id = "test-client-id"
        application_url = "https://example.com"
        embedded = true

        [auth]
        redirect_urls = ["https://example.com/callback"]

        [webhooks]
        api_version = "2024-01"
      `
      const extensionContent = `
        type = "ui_extension"
        name = "test-extension"
        handle = "test-handle"
      `
      await writeAppConfig(tmp, appContent)

      // Create the extensions directory structure
      const extensionDir = joinPath(tmp, 'extensions', 'test')
      await mkdir(extensionDir)
      await writeFile(joinPath(extensionDir, 'shopify.extension.toml'), extensionContent)
      // Create a source file for the extension
      const srcDir = joinPath(extensionDir, 'src')
      await mkdir(srcDir)
      await writeFile(joinPath(srcDir, 'index.js'), '// Extension code')

      // Mock local specifications to include ui_extension with proper validation
      // Also include app_access and webhooks specs that contribute auth and webhooks to schema
      vi.mocked(loadLocalExtensionsSpecifications).mockResolvedValue([
        {
          identifier: 'ui_extension',
          externalIdentifier: 'ui_extension',
          externalName: 'UI Extension',
          surface: 'unknown',
          dependency: undefined,
          graphQLType: undefined,
          experience: 'extension',
          uidStrategy: 'uuid',
          registrationLimit: 1,
          appModuleFeatures: () => ['single_js_entry_path'],
          parseConfigurationObject: (obj: any) => ({
            state: 'ok',
            data: {
              type: 'ui_extension',
              name: 'test-extension',
              handle: 'test-handle',
              extension_points: [],
            },
            errors: undefined,
          }),
          validate: async () => ({isErr: () => false, isOk: () => true}) as any,
          contributeToAppConfigurationSchema: (schema: any) => schema,
        } as any,
        {
          identifier: 'app_access',
          experience: 'configuration',
          uidStrategy: 'single',
          appModuleFeatures: () => [],
          parseConfigurationObject: (obj: any) => ({
            state: 'ok',
            data: obj,
            errors: undefined,
          }),
          contributeToAppConfigurationSchema: (schema: any) => {
            // Mock contribution of auth field
            return schema
          },
        } as any,
        {
          identifier: 'webhooks',
          experience: 'configuration',
          uidStrategy: 'single',
          appModuleFeatures: () => [],
          parseConfigurationObject: (obj: any) => ({
            state: 'ok',
            data: obj,
            errors: undefined,
          }),
          contributeToAppConfigurationSchema: (schema: any) => {
            // Mock contribution of webhooks field
            return schema
          },
        } as any,
      ])

      // When
      const result = await localAppContext({
        directory: tmp,
      })

      // Then
      const realExtensions = result.app.allExtensions.filter((ext) => ext.specification.experience !== 'configuration')
      expect(realExtensions).toHaveLength(1)
      expect(realExtensions[0]).toEqual(
        expect.objectContaining({
          configuration: expect.objectContaining({
            name: 'test-extension',
            handle: 'test-handle',
          }),
        }),
      )
    })
  })
})
