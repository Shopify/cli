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
      const content = `client_id="test-api-key"`
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
          configuration: {
            client_id: 'test-api-key',
            path: normalizePath(joinPath(tmp, 'shopify.app.toml')),
          },
        }),
        remoteApp: mockRemoteApp,
        developerPlatformClient: expect.any(Object),
        specifications: [],
        organization: mockOrganization,
      })
      expect(link).not.toHaveBeenCalled()
    })
  })

  test('links app when it is not linked, and config file is cached', async () => {
    await inTemporaryDirectory(async (tmp) => {
      const content = ''
      await writeAppConfig(tmp, content, 'shopify.app.stg.toml')
      localStorage.setCachedAppInfo({
        appId: 'test-api-key',
        title: 'Test App',
        directory: tmp,
        orgId: 'test-org-id',
        configFile: 'shopify.app.stg.toml',
      })

      // Given
      vi.mocked(link).mockResolvedValue({
        remoteApp: mockRemoteApp,
        state: {
          state: 'connected-app',
          appDirectory: tmp,
          configurationPath: `${tmp}/shopify.app.stg.toml`,
          configSource: 'cached',
          configurationFileName: 'shopify.app.stg.toml',
          basicConfiguration: {client_id: 'test-api-key', path: normalizePath(joinPath(tmp, 'shopify.app.stg.toml'))},
        },
        configuration: {
          client_id: 'test-api-key',
          name: 'test-app',
          application_url: 'https://test-app.com',
          path: normalizePath(joinPath(tmp, 'shopify.app.stg.toml')),
          embedded: false,
        },
      })

      // When
      const result = await linkedAppContext({
        directory: tmp,
        forceRelink: false,
        userProvidedConfigName: undefined,
        clientId: undefined,
      })

      // Then
      expect(result).toEqual({
        app: expect.any(Object),
        remoteApp: mockRemoteApp,
        developerPlatformClient: expect.any(Object),
        specifications: [],
        organization: mockOrganization,
      })
      expect(link).toHaveBeenCalledWith({directory: tmp, apiKey: undefined, configName: 'shopify.app.stg.toml'})
    })
  })

  test('updates cached app info when remoteApp matches', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      vi.mocked(appFromIdentifiers).mockResolvedValue({...mockRemoteApp, apiKey: 'test-api-key-new'})
      const content = `client_id="test-api-key-new"`
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
      const content = `client_id="test-api-key"`
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
      const content = `client_id="test-api-key"`
      await writeAppConfig(tmp, content)

      vi.mocked(link).mockResolvedValue({
        remoteApp: mockRemoteApp,
        state: {
          state: 'connected-app',
          appDirectory: tmp,
          configurationPath: `${tmp}/shopify.app.toml`,
          configSource: 'cached',
          configurationFileName: 'shopify.app.toml',
          basicConfiguration: {client_id: 'test-api-key', path: normalizePath(joinPath(tmp, 'shopify.app.toml'))},
        },
        configuration: {
          client_id: 'test-api-key',
          name: 'test-app',
          application_url: 'https://test-app.com',
          path: normalizePath(joinPath(tmp, 'shopify.app.toml')),
          embedded: false,
        },
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

  test('logs metadata', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const content = `client_id="test-api-key"`
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

  test('uses unsafeReportMode when provided', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const content = `client_id="test-api-key"`
      await writeAppConfig(tmp, content)
      const loadSpy = vi.spyOn(loader, 'loadAppUsingConfigurationState')

      // When
      await linkedAppContext({
        directory: tmp,
        forceRelink: false,
        userProvidedConfigName: undefined,
        clientId: undefined,
        unsafeReportMode: true,
      })

      // Then
      expect(vi.mocked(addUidToTomlsIfNecessary)).not.toHaveBeenCalled()
      expect(loadSpy).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({mode: 'report'}))
      loadSpy.mockRestore()
    })
  })

  test('does not use unsafeReportMode when not provided', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const content = `client_id="test-api-key"`
      await writeAppConfig(tmp, content)
      const loadSpy = vi.spyOn(loader, 'loadAppUsingConfigurationState')

      // When
      await linkedAppContext({
        directory: tmp,
        forceRelink: false,
        userProvidedConfigName: undefined,
        clientId: undefined,
      })

      // Then
      expect(vi.mocked(addUidToTomlsIfNecessary)).toHaveBeenCalled()
      expect(loadSpy).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({mode: 'strict'}))
      loadSpy.mockRestore()
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
      `
      await writeAppConfig(tmp, content)

      // When
      const result = await localAppContext({
        directory: tmp,
      })

      // Then
      expect(result).toBeDefined()
      expect(result.name).toEqual(expect.any(String))
      expect(result.directory).toEqual(normalizePath(tmp))
      expect(result.configuration).toEqual(
        expect.objectContaining({
          name: 'test-app',
          path: normalizePath(joinPath(tmp, 'shopify.app.toml')),
        }),
      )
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
      `
      await writeAppConfig(tmp, content, 'shopify.app.custom.toml')

      // When
      const result = await localAppContext({
        directory: tmp,
        userProvidedConfigName: 'shopify.app.custom.toml',
      })

      // Then
      expect(result).toBeDefined()
      expect(result.configuration).toEqual(
        expect.objectContaining({
          name: 'test-app-custom',
          path: normalizePath(joinPath(tmp, 'shopify.app.custom.toml')),
        }),
      )
    })
  })

  test('uses unsafeReportMode when provided', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given - use a valid configuration but with an extra field to test report mode
      const content = `
        name = "test-app"
      `
      await writeAppConfig(tmp, content)
      const loadSpy = vi.spyOn(loader, 'loadApp')

      // When
      const result = await localAppContext({
        directory: tmp,
        unsafeReportMode: true,
      })

      // Then
      expect(result).toBeDefined()
      expect(loadSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'report',
        }),
      )
      loadSpy.mockRestore()
    })
  })

  test('defaults to strict mode when unsafeReportMode is not provided', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const content = `
        name = "test-app"
      `
      await writeAppConfig(tmp, content)
      const loadSpy = vi.spyOn(loader, 'loadApp')

      // When
      await localAppContext({
        directory: tmp,
      })

      // Then
      expect(loadSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'strict',
        }),
      )
      loadSpy.mockRestore()
    })
  })

  test('loads app with extensions', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const appContent = `
        name = "test-app"
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
          validate: async () => ({isErr: () => false, isOk: () => true} as any),
          contributeToAppConfigurationSchema: (schema: any) => schema,
        } as any,
      ])

      // When
      const result = await localAppContext({
        directory: tmp,
      })

      // Then
      expect(result.allExtensions).toHaveLength(1)
      expect(result.allExtensions[0]).toEqual(
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
