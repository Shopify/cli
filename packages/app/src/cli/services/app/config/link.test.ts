import link, {LinkOptions} from './link.js'
import {setCurrentConfigPreference} from './use.js'
import {
  testApp,
  testOrganizationApp,
  buildVersionedAppSchema,
  testDeveloperPlatformClient,
} from '../../../models/app/app.test-data.js'
import {selectConfigName} from '../../../prompts/config.js'
import {loadApp, loadOpaqueApp} from '../../../models/app/loader.js'
import {InvalidApiKeyErrorMessage, fetchOrCreateOrganizationApp, appFromIdentifiers} from '../../context.js'
import {getCachedCommandInfo} from '../../local-storage.js'
import {AppInterface, CurrentAppConfiguration} from '../../../models/app/app.js'
import {fetchAppRemoteConfiguration} from '../select-app.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {MinimalAppIdentifiers, OrganizationApp} from '../../../models/organization.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {fileExistsSync, inTemporaryDirectory, readFile, writeFileSync} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {outputContent} from '@shopify/cli-kit/node/output'
import {setPathValue} from '@shopify/cli-kit/common/object'

vi.mock('./use.js')
vi.mock('../../../prompts/config.js')
vi.mock('@shopify/cli-kit/node/is-global', () => ({
  currentProcessIsGlobal: () => false,
}))
vi.mock('../../../models/app/loader.js', async () => {
  const loader: any = await vi.importActual('../../../models/app/loader.js')
  return {
    ...loader,
    loadApp: vi.fn(),
    loadOpaqueApp: vi.fn(),
  }
})
vi.mock('../../local-storage')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('../../context/partner-account-info.js')
vi.mock('../../context.js')
vi.mock('../select-app.js')

const DEFAULT_REMOTE_CONFIGURATION = {
  name: 'app1',
  application_url: 'https://example.com',
  embedded: true,
  auth: {redirect_urls: ['https://example.com/callback1']},
  webhooks: {api_version: '2023-07'},
  pos: {embedded: false},
  access_scopes: {use_legacy_install_flow: true},
}

function buildDeveloperPlatformClient(extraFields: Partial<DeveloperPlatformClient> = {}): DeveloperPlatformClient {
  return testDeveloperPlatformClient({
    async appFromIdentifiers(apiKey: string): Promise<OrganizationApp | undefined> {
      switch (apiKey) {
        case 'api-key':
          return testOrganizationApp({developerPlatformClient: this as DeveloperPlatformClient})
        default:
          return undefined
      }
    },
    ...extraFields,
  })
}

beforeEach(async () => {
  vi.mocked(fetchAppRemoteConfiguration).mockResolvedValue(DEFAULT_REMOTE_CONFIGURATION)
  // Default mock for selectConfigName - tests that need a specific value can override
  vi.mocked(selectConfigName).mockResolvedValue('shopify.app.toml')
})

describe('link', () => {
  test('does not ask for a name when it is provided as a flag, returns the remote app and the linked state', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const developerPlatformClient = buildDeveloperPlatformClient()
      const options: LinkOptions = {
        directory: tmp,
        configName: 'Default value',
        developerPlatformClient,
      }
      await mockLoadOpaqueAppWithApp(tmp)
      vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue(mockRemoteApp({developerPlatformClient}))

      // When
      const {configuration, configFileName, remoteApp} = await link(options)

      // Then
      expect(selectConfigName).not.toHaveBeenCalled()
      expect(fileExistsSync(joinPath(tmp, 'shopify.app.default-value.toml'))).toBeTruthy()
      expect(configuration).toEqual({
        client_id: '12345',
        name: 'app1',
        application_url: 'https://example.com',
        embedded: true,
        access_scopes: {
          scopes: 'read_products',
          use_legacy_install_flow: true,
        },
        auth: {
          redirect_urls: ['https://example.com/callback1'],
        },
        webhooks: {
          api_version: '2023-07',
        },
        pos: {
          embedded: false,
        },
      })

      expect(configFileName).toBe('shopify.app.default-value.toml')

      expect(remoteApp).toEqual(mockRemoteApp({developerPlatformClient}))
    })
  })

  test('does not ask for a name when the selected app is already linked', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const developerPlatformClient = buildDeveloperPlatformClient()
      const options: LinkOptions = {
        directory: tmp,
        developerPlatformClient,
      }
      const remoteApp = mockRemoteApp({developerPlatformClient})
      const filePath = joinPath(tmp, 'shopify.app.staging.toml')
      const initialContent = `
      client_id = "${remoteApp.apiKey}"
      `
      writeFileSync(filePath, initialContent)
      await mockLoadOpaqueAppWithApp(tmp, undefined, [], 'current')
      vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue(remoteApp)

      // When
      const {configuration} = await link(options)

      // Then
      expect(selectConfigName).not.toHaveBeenCalled()
      const content = await readFile(joinPath(tmp, 'shopify.app.staging.toml'))
      expect(configuration).toEqual({
        client_id: '12345',
        name: 'app1',
        application_url: 'https://example.com',
        embedded: true,
        access_scopes: {
          scopes: 'read_products',
          use_legacy_install_flow: true,
        },
        auth: {
          redirect_urls: ['https://example.com/callback1'],
        },
        webhooks: {
          api_version: '2023-07',
        },
        pos: {
          embedded: false,
        },
      })
      expect(content).toMatchSnapshot()
    })
  })

  test('creates a new shopify.app.toml file when it does not exist using existing app version configuration instead of the api client configuration', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const developerPlatformClient = buildDeveloperPlatformClient()
      const options: LinkOptions = {
        directory: tmp,
        developerPlatformClient,
      }
      mockLoadOpaqueAppWithError()
      const apiClientConfiguration = {
        title: 'new-title',
        applicationUrl: 'https://api-client-config.com',
        redirectUrlWhitelist: ['https://api-client-config.com/callback'],
        requestedAccessScopes: ['write_products'],
        webhookApiVersion: '2023-07',
        embedded: false,
        posEmbedded: true,
        preferencesUrl: 'https://api-client-config.com/preferences',
        gdprWebhooks: {
          customerDeletionUrl: 'https://api-client-config.com/customer-deletion',
          customerDataRequestUrl: 'https://api-client-config.com/customer-data-request',
          shopDeletionUrl: 'https://api-client-config.com/shop-deletion',
        },
        appProxy: {
          subPath: '/api',
          subPathPrefix: 'prefix',
          url: 'https://api-client-config.com/proxy',
        },
        developerPlatformClient,
      }
      vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue({
        ...mockRemoteApp(apiClientConfiguration),
        newApp: true,
        developerPlatformClient,
      })

      // When
      const {configuration, configFileName} = await link(options)

      // Then
      const content = await readFile(joinPath(tmp, 'shopify.app.toml'))
      expect(setCurrentConfigPreference).toHaveBeenCalledWith(configuration, {
        configFileName: 'shopify.app.toml',
        directory: tmp,
      })
      expect(renderSuccess).toHaveBeenCalledWith({
        headline: 'shopify.app.toml is now linked to "app1" on Shopify',
        body: 'Using shopify.app.toml as your default config.',
        nextSteps: [
          [`Make updates to shopify.app.toml in your local project`],
          ['To upload your config, run', {command: 'npm run shopify app deploy'}],
        ],
        reference: [
          {
            link: {
              label: 'App configuration',
              url: 'https://shopify.dev/docs/apps/tools/cli/configuration',
            },
          },
        ],
      })
      expect(configuration).toEqual({
        client_id: '12345',
        name: 'app1',
        application_url: 'https://example.com',
        embedded: true,
        access_scopes: {
          use_legacy_install_flow: true,
        },
        auth: {
          redirect_urls: ['https://example.com/callback1'],
        },
        webhooks: {
          api_version: '2023-07',
        },
        pos: {
          embedded: false,
        },
        build: {
          include_config_on_deploy: true,
        },
      })
      expect(content).toMatchSnapshot()
      expect(configFileName).toBe('shopify.app.toml')
    })
  })

  test('uses the api client configuration in case there is no configuration app modules', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const developerPlatformClient = buildDeveloperPlatformClient()
      const options: LinkOptions = {
        directory: tmp,
        developerPlatformClient,
      }
      mockLoadOpaqueAppWithError()
      const apiClientConfiguration = {
        title: 'new-title',
        applicationUrl: 'https://api-client-config.com',
        redirectUrlWhitelist: ['https://api-client-config.com/callback'],
        requestedAccessScopes: ['write_products'],
        webhookApiVersion: '2023-07',
        embedded: false,
        posEmbedded: true,
        preferencesUrl: 'https://api-client-config.com/preferences',
        gdprWebhooks: {
          customerDeletionUrl: 'https://api-client-config.com/customer-deletion',
          customerDataRequestUrl: 'https://api-client-config.com/customer-data-request',
          shopDeletionUrl: 'https://api-client-config.com/shop-deletion',
        },
        appProxy: {
          subPath: '/api',
          subPathPrefix: 'prefix',
          url: 'https://api-client-config.com/proxy',
        },
      }
      vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue({
        ...mockRemoteApp(apiClientConfiguration),
        newApp: true,
        developerPlatformClient,
      })
      vi.mocked(fetchAppRemoteConfiguration).mockResolvedValue(undefined)

      // When
      const {configuration} = await link(options)

      // Then
      const content = await readFile(joinPath(tmp, 'shopify.app.toml'))

      expect(setCurrentConfigPreference).toHaveBeenCalledWith(configuration, {
        configFileName: 'shopify.app.toml',
        directory: tmp,
      })
      expect(renderSuccess).toHaveBeenCalledWith({
        headline: 'shopify.app.toml is now linked to "new-title" on Shopify',
        body: 'Using shopify.app.toml as your default config.',
        nextSteps: [
          [`Make updates to shopify.app.toml in your local project`],
          ['To upload your config, run', {command: 'npm run shopify app deploy'}],
        ],
        reference: [
          {
            link: {
              label: 'App configuration',
              url: 'https://shopify.dev/docs/apps/tools/cli/configuration',
            },
          },
        ],
      })
      expect(configuration).toEqual({
        client_id: '12345',
        name: 'new-title',
        application_url: 'https://api-client-config.com',
        embedded: false,
        access_scopes: {
          scopes: 'write_products',
        },
        app_preferences: {
          url: 'https://api-client-config.com/preferences',
        },
        app_proxy: {
          prefix: 'prefix',
          subpath: '/api',
          url: 'https://api-client-config.com/proxy',
        },
        auth: {
          redirect_urls: ['https://api-client-config.com/callback'],
        },
        webhooks: {
          api_version: '2023-07',
          privacy_compliance: {
            customer_data_request_url: 'https://api-client-config.com/customer-data-request',
            customer_deletion_url: 'https://api-client-config.com/customer-deletion',
            shop_deletion_url: 'https://api-client-config.com/shop-deletion',
          },
        },
        pos: {
          embedded: true,
        },
        build: {
          include_config_on_deploy: true,
        },
      })
      expect(content).toMatchSnapshot()
    })
  })

  test('creates a new shopify.app.staging.toml file when shopify.app.toml already linked', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const developerPlatformClient = buildDeveloperPlatformClient()
      const options: LinkOptions = {
        directory: tmp,
        developerPlatformClient,
      }
      const localApp = {
        configPath: 'shopify.app.development.toml',
        configuration: {
          name: 'my app',
          client_id: '12345',
          webhooks: {api_version: '2023-04'},
          application_url: 'https://myapp.com',
          build: {
            automatically_update_urls_on_dev: true,
            dev_store_url: 'my-store.myshopify.com',
            include_config_on_deploy: true,
          },
          access_scopes: {
            scopes: 'write_products',
          },
        } as CurrentAppConfiguration,
      }
      // Write actual TOML file so getTomls() finds it and reuses existing config
      const filePath = joinPath(tmp, 'shopify.app.development.toml')
      writeFileSync(filePath, 'client_id = "12345"\nname = "my app"')
      await mockLoadOpaqueAppWithApp(tmp, localApp, [], 'current')
      vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue(
        testOrganizationApp({
          apiKey: '12345',
          developerPlatformClient,
        }),
      )
      const remoteConfiguration = {
        ...DEFAULT_REMOTE_CONFIGURATION,
        name: 'my app',
        application_url: 'https://myapp.com',
        access_scopes: {scopes: 'write_products'},
      }
      vi.mocked(fetchAppRemoteConfiguration).mockResolvedValue(remoteConfiguration)

      // When
      const {configuration} = await link(options)

      // Then - since client_id matches and file exists, reuse shopify.app.development.toml
      expect(selectConfigName).not.toHaveBeenCalled()
      const content = await readFile(joinPath(tmp, 'shopify.app.development.toml'))
      expect(content).toMatchSnapshot()

      expect(setCurrentConfigPreference).toHaveBeenCalledWith(configuration, {
        configFileName: 'shopify.app.development.toml',
        directory: tmp,
      })
      expect(renderSuccess).toHaveBeenCalledWith({
        headline: 'shopify.app.development.toml is now linked to "my app" on Shopify',
        body: 'Using shopify.app.development.toml as your default config.',
        nextSteps: [
          [`Make updates to shopify.app.development.toml in your local project`],
          ['To upload your config, run', {command: 'yarn shopify app deploy'}],
        ],
        reference: [
          {
            link: {
              label: 'App configuration',
              url: 'https://shopify.dev/docs/apps/tools/cli/configuration',
            },
          },
        ],
      })
      expect(configuration).toEqual({
        client_id: '12345',
        name: 'my app',
        application_url: 'https://myapp.com',
        embedded: true,
        access_scopes: {
          scopes: 'write_products',
        },
        auth: {
          redirect_urls: ['https://example.com/callback1'],
        },
        webhooks: {
          api_version: '2023-07',
        },
        pos: {
          embedded: false,
        },
        build: {
          automatically_update_urls_on_dev: true,
          dev_store_url: 'my-store.myshopify.com',
          include_config_on_deploy: true,
        },
      })
      expect(content).toMatchSnapshot()
    })
  })

  test('the local configuration is discarded if the client_id is different from the remote one', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const developerPlatformClient = buildDeveloperPlatformClient()
      const options: LinkOptions = {
        directory: tmp,
        developerPlatformClient,
      }
      const localApp = {
        configuration: {
          name: 'my app',
          client_id: '12345',
          scopes: 'write_products',
          webhooks: {api_version: '2023-04'},
          application_url: 'https://myapp.com',
          embedded: false,
          build: {
            automatically_update_urls_on_dev: true,
            dev_store_url: 'my-store.myshopify.com',
          },
        },
      }
      // Write actual TOML file so getTomls() finds it (needed for selectConfigName logic)
      const filePath = joinPath(tmp, 'shopify.app.toml')
      writeFileSync(filePath, 'client_id = "12345"\nname = "my app"')
      await mockLoadOpaqueAppWithApp(tmp, localApp, [], 'current')
      vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue(
        testOrganizationApp({
          apiKey: 'different-api-key',
          developerPlatformClient,
        }),
      )
      const remoteConfiguration = {
        ...DEFAULT_REMOTE_CONFIGURATION,
        name: 'my app',
        application_url: 'https://myapp.com',
        access_scopes: {scopes: 'write_products'},
      }
      vi.mocked(fetchAppRemoteConfiguration).mockResolvedValue(remoteConfiguration)
      vi.mocked(selectConfigName).mockResolvedValue('shopify.app.staging.toml')

      // When
      const {configuration} = await link(options)

      // Then
      const content = await readFile(joinPath(tmp, 'shopify.app.staging.toml'))
      expect(configuration).toEqual({
        client_id: 'different-api-key',
        name: 'my app',
        application_url: 'https://myapp.com',
        embedded: true,
        access_scopes: {
          scopes: 'write_products',
        },
        auth: {
          redirect_urls: ['https://example.com/callback1'],
        },
        webhooks: {
          api_version: '2023-07',
        },
        pos: {
          embedded: false,
        },
      })
      expect(content).toMatchSnapshot()
    })
  })

  test('updates the shopify.app.toml when it already exists and is unlinked', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const filePath = joinPath(tmp, 'shopify.app.toml')
      const initialContent = `scopes = ""
      `
      writeFileSync(filePath, initialContent)
      const developerPlatformClient = buildDeveloperPlatformClient()
      const options: LinkOptions = {
        directory: tmp,
        developerPlatformClient,
      }
      await mockLoadOpaqueAppWithApp(tmp)
      vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue(mockRemoteApp({developerPlatformClient}))

      // When
      const {configuration} = await link(options)

      // Then
      const content = await readFile(joinPath(tmp, 'shopify.app.toml'))
      expect(renderSuccess).toHaveBeenCalledWith({
        headline: 'shopify.app.toml is now linked to "app1" on Shopify',
        body: 'Using shopify.app.toml as your default config.',
        nextSteps: [
          [`Make updates to shopify.app.toml in your local project`],
          ['To upload your config, run', {command: 'yarn shopify app deploy'}],
        ],
        reference: [
          {
            link: {
              label: 'App configuration',
              url: 'https://shopify.dev/docs/apps/tools/cli/configuration',
            },
          },
        ],
      })
      expect(configuration).toEqual({
        client_id: '12345',
        name: 'app1',
        application_url: 'https://example.com',
        embedded: true,
        access_scopes: {
          scopes: 'read_products',
          use_legacy_install_flow: true,
        },
        auth: {
          redirect_urls: ['https://example.com/callback1'],
        },
        webhooks: {
          api_version: '2023-07',
        },
        pos: {
          embedded: false,
        },
      })
      expect(content).toMatchSnapshot()
    })
  })

  test('does not render success banner if shouldRenderSuccess is false', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const filePath = joinPath(tmp, 'shopify.app.toml')
      const initialContent = `scopes = ""
      `
      writeFileSync(filePath, initialContent)
      const developerPlatformClient = buildDeveloperPlatformClient()
      const options: LinkOptions = {
        directory: tmp,
        developerPlatformClient,
      }
      await mockLoadOpaqueAppWithApp(tmp)
      vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue(mockRemoteApp({developerPlatformClient}))

      // When
      const {configuration} = await link(options, false)

      // Then
      const content = await readFile(joinPath(tmp, 'shopify.app.toml'))
      expect(renderSuccess).not.toHaveBeenCalled()
      expect(configuration).toEqual({
        client_id: '12345',
        name: 'app1',
        application_url: 'https://example.com',
        embedded: true,
        access_scopes: {
          scopes: 'read_products',
          use_legacy_install_flow: true,
        },
        auth: {
          redirect_urls: ['https://example.com/callback1'],
        },
        webhooks: {
          api_version: '2023-07',
        },
        pos: {
          embedded: false,
        },
      })
      expect(content).toMatchSnapshot()
    })
  })

  test('fetches the remote app when an api key is provided', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const developerPlatformClient = buildDeveloperPlatformClient()
      const options: LinkOptions = {
        directory: tmp,
        apiKey: 'api-key',
        developerPlatformClient,
      }
      await mockLoadOpaqueAppWithApp(tmp)
      vi.mocked(appFromIdentifiers).mockImplementation(async ({apiKey}: {apiKey: string}) => {
        return (await developerPlatformClient.appFromIdentifiers(apiKey))!
      })

      // When
      const {configuration} = await link(options)

      // Then
      const content = await readFile(joinPath(tmp, 'shopify.app.toml'))
      expect(content).toContain('name = "app1"')
      expect(configuration).toEqual({
        client_id: 'api-key',
        name: 'app1',
        application_url: 'https://example.com',
        embedded: true,
        access_scopes: {
          use_legacy_install_flow: true,
        },
        auth: {
          redirect_urls: ['https://example.com/callback1'],
        },
        webhooks: {
          api_version: '2023-07',
        },
        pos: {
          embedded: false,
        },
      })
    })
  })

  test('throws an error when an invalid api key is is provided', async () => {
    vi.mocked(InvalidApiKeyErrorMessage).mockReturnValue({
      message: outputContent`Invalid Client ID`,
      tryMessage: outputContent`You can find the Client ID in the app settings in the Partners Dashboard.`,
    })

    await inTemporaryDirectory(async (tmp) => {
      // Given
      const developerPlatformClient = buildDeveloperPlatformClient()
      const options: LinkOptions = {
        directory: tmp,
        apiKey: 'wrong-api-key',
        developerPlatformClient,
      }
      await mockLoadOpaqueAppWithApp(tmp)
      vi.mocked(selectConfigName).mockResolvedValue('shopify.app.staging.toml')

      // When
      const result = link(options)

      // Then
      await expect(result).rejects.toThrow(/Invalid Client ID/)
    })
  })

  test('skips config name question if re-linking to existing current app schema', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const developerPlatformClient = buildDeveloperPlatformClient()
      const options: LinkOptions = {
        directory: tmp,
        developerPlatformClient,
      }
      const localApp = {
        configPath: 'shopify.app.foo.toml',
        configuration: {
          name: 'my app',
          client_id: '12345',
          webhooks: {api_version: '2023-04'},
          application_url: 'https://myapp.com',
          access_scopes: {
            scopes: 'write_products',
          },
        } as CurrentAppConfiguration,
      }
      await mockLoadOpaqueAppWithApp(tmp, localApp)
      vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue(
        testOrganizationApp({
          apiKey: '12345',
          developerPlatformClient,
        }),
      )
      vi.mocked(getCachedCommandInfo).mockReturnValue({askConfigName: false, selectedToml: 'shopify.app.foo.toml'})

      // When
      const {configuration} = await link(options)
      const content = await readFile(joinPath(tmp, 'shopify.app.foo.toml'))

      expect(selectConfigName).not.toHaveBeenCalled()
      expect(setCurrentConfigPreference).toHaveBeenCalledWith(configuration, {
        configFileName: 'shopify.app.foo.toml',
        directory: tmp,
      })
      expect(configuration).toEqual({
        client_id: '12345',
        name: 'app1',
        application_url: 'https://example.com',
        embedded: true,
        access_scopes: {
          use_legacy_install_flow: true,
          scopes: 'write_products',
        },
        auth: {
          redirect_urls: ['https://example.com/callback1'],
        },
        webhooks: {
          api_version: '2023-07',
        },
        pos: {
          embedded: false,
        },
      })
      expect(content).toMatchSnapshot()
    })
  })

  test('generates the file when there is no shopify.app.toml', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const developerPlatformClient = buildDeveloperPlatformClient()
      const options: LinkOptions = {
        directory: tmp,
        developerPlatformClient,
      }
      mockLoadOpaqueAppWithError()
      vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue(mockRemoteApp({developerPlatformClient}))

      // When
      const {configuration} = await link(options)

      // Then
      const content = await readFile(joinPath(tmp, 'shopify.app.toml'))

      expect(configuration).toEqual({
        client_id: '12345',
        name: 'app1',
        application_url: 'https://example.com',
        embedded: true,
        access_scopes: {
          use_legacy_install_flow: true,
        },
        auth: {
          redirect_urls: ['https://example.com/callback1'],
        },
        webhooks: {
          api_version: '2023-07',
        },
        pos: {
          embedded: false,
        },
      })
      expect(content).toMatchSnapshot()
      // Should use default filename without prompting when no TOMLs exist
      expect(selectConfigName).not.toHaveBeenCalled()
    })
  })

  test('uses default shopify.app.toml without prompting when no config files exist and client-id is provided', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given - no TOML files in directory, but client-id is provided
      // This simulates: shopify app config link --client-id=12345
      const developerPlatformClient = buildDeveloperPlatformClient()
      const options: LinkOptions = {
        directory: tmp,
        apiKey: '12345',
        developerPlatformClient,
      }
      mockLoadOpaqueAppWithError()
      vi.mocked(appFromIdentifiers).mockResolvedValue(mockRemoteApp({developerPlatformClient}))

      // When
      const {configFileName} = await link(options)

      // Then - should use default filename without prompting
      expect(configFileName).toBe('shopify.app.toml')
      expect(selectConfigName).not.toHaveBeenCalled()
    })
  })

  test('uses scopes on platform if defined', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const developerPlatformClient = buildDeveloperPlatformClient()
      const options: LinkOptions = {
        directory: tmp,
        developerPlatformClient,
      }
      await mockLoadOpaqueAppWithApp(tmp)
      vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue(mockRemoteApp({developerPlatformClient}))
      const remoteConfiguration = {
        ...DEFAULT_REMOTE_CONFIGURATION,
        access_scopes: {scopes: 'read_products,write_orders'},
      }
      vi.mocked(fetchAppRemoteConfiguration).mockResolvedValue(remoteConfiguration)

      // When
      const {configuration} = await link(options)

      // Then
      const content = await readFile(joinPath(tmp, 'shopify.app.toml'))

      expect(configuration).toEqual({
        client_id: '12345',
        name: 'app1',
        application_url: 'https://example.com',
        embedded: true,
        access_scopes: {
          scopes: 'read_products,write_orders',
          use_legacy_install_flow: true,
        },
        auth: {
          redirect_urls: ['https://example.com/callback1'],
        },
        webhooks: {
          api_version: '2023-07',
        },
        pos: {
          embedded: false,
        },
      })
      expect(content).toMatchSnapshot()
    })
  })

  test('fetches the privacy compliance webhooks from the configuration module', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const developerPlatformClient = testDeveloperPlatformClient({
        appExtensionRegistrations: (_app: MinimalAppIdentifiers) => Promise.resolve(remoteExtensionRegistrations),
      })
      const remoteExtensionRegistrations = {
        app: {
          extensionRegistrations: [],
          configurationRegistrations: [
            {
              type: 'PRIVACY_COMPLIANCE_WEBHOOKS',
              id: '123',
              uuid: '123',
              title: 'Privacy compliance webhooks',
              activeVersion: {
                config: JSON.stringify({
                  shop_redact_url: null,
                  customers_redact_url: 'https://example.com/customers',
                  customers_data_request_url: 'https://example.com/customers',
                }),
              },
            },
          ],
          dashboardManagedExtensionRegistrations: [],
        },
      }
      const options: LinkOptions = {
        directory: tmp,
        developerPlatformClient,
      }

      mockLoadOpaqueAppWithError()
      vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue(mockRemoteApp({developerPlatformClient}))
      const remoteConfiguration = {
        ...DEFAULT_REMOTE_CONFIGURATION,
        webhooks: {
          api_version: '2023-07',
          subscriptions: [
            {
              compliance_topics: ['customers/redact', 'customers/data_request'],
              uri: 'https://example.com/customers',
            },
          ],
        },
      }
      vi.mocked(fetchAppRemoteConfiguration).mockResolvedValue(remoteConfiguration)

      // When
      const {configuration} = await link(options)

      // Then
      const content = await readFile(joinPath(tmp, 'shopify.app.toml'))

      expect(setCurrentConfigPreference).toHaveBeenCalledWith(configuration, {
        configFileName: 'shopify.app.toml',
        directory: tmp,
      })
      expect(renderSuccess).toHaveBeenCalledWith({
        headline: 'shopify.app.toml is now linked to "app1" on Shopify',
        body: 'Using shopify.app.toml as your default config.',
        nextSteps: [
          [`Make updates to shopify.app.toml in your local project`],
          ['To upload your config, run', {command: 'npm run shopify app deploy'}],
        ],
        reference: [
          {
            link: {
              label: 'App configuration',
              url: 'https://shopify.dev/docs/apps/tools/cli/configuration',
            },
          },
        ],
      })
      expect(configuration).toEqual({
        client_id: '12345',
        name: 'app1',
        application_url: 'https://example.com',
        embedded: true,
        build: undefined,
        access_scopes: {
          use_legacy_install_flow: true,
        },
        auth: {
          redirect_urls: ['https://example.com/callback1'],
        },
        webhooks: {
          api_version: '2023-07',
          subscriptions: [
            {
              compliance_topics: ['customers/redact', 'customers/data_request'],
              uri: 'https://example.com/customers',
            },
          ],
        },
        pos: {
          embedded: false,
        },
      })
      expect(content).toMatchSnapshot()
    })
  })

  test('simplifies the webhook config using relative paths', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const developerPlatformClient = testDeveloperPlatformClient({
        appExtensionRegistrations: (_app: MinimalAppIdentifiers) => Promise.resolve(remoteExtensionRegistrations),
      })
      const remoteExtensionRegistrations = {
        app: {
          extensionRegistrations: [],
          configurationRegistrations: [
            {
              type: 'WEBHOOK_SUBSCRIPTION',
              id: '123',
              uuid: '123',
              title: 'Webhook subscription',
              activeVersion: {
                config: JSON.stringify({
                  api_version: '2024-01',
                  topic: 'products/create',
                  uri: 'https://my-app-url.com/webhooks',
                }),
              },
            },
            {
              type: 'WEBHOOK_SUBSCRIPTION',
              id: '1234',
              uuid: '1234',
              title: 'Webhook subscription',
              activeVersion: {
                config: JSON.stringify({
                  api_version: '2024-01',
                  topic: 'products/update',
                  uri: 'https://my-app-url.com/webhooks',
                }),
              },
            },
          ],
          dashboardManagedExtensionRegistrations: [],
        },
      }
      const options: LinkOptions = {
        directory: tmp,
        developerPlatformClient,
      }

      await mockLoadOpaqueAppWithApp(tmp)
      vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue(mockRemoteApp({developerPlatformClient}))
      const remoteConfiguration = {
        ...DEFAULT_REMOTE_CONFIGURATION,
        application_url: 'https://my-app-url.com',
        webhooks: {
          api_version: '2023-07',
          subscriptions: [
            {
              topics: ['products/create'],
              uri: 'https://my-app-url.com/webhooks',
            },
            {
              topics: ['products/update'],
              uri: 'https://my-app-url.com/webhooks',
            },
          ],
        },
      }
      vi.mocked(fetchAppRemoteConfiguration).mockResolvedValue(remoteConfiguration)

      // When
      const {configuration} = await link(options)

      // Then
      const content = await readFile(joinPath(tmp, 'shopify.app.toml'))

      expect(configuration).toEqual({
        client_id: '12345',
        name: 'app1',
        application_url: 'https://my-app-url.com',
        embedded: true,
        access_scopes: {
          scopes: 'read_products',
          use_legacy_install_flow: true,
        },
        build: undefined,
        auth: {
          redirect_urls: ['https://example.com/callback1'],
        },
        webhooks: {
          api_version: '2023-07',
          subscriptions: [
            {
              topics: ['products/create'],
              uri: 'https://my-app-url.com/webhooks',
            },
            {
              topics: ['products/update'],
              uri: 'https://my-app-url.com/webhooks',
            },
          ],
        },
        pos: {
          embedded: false,
        },
      })
      expect(content).toMatchSnapshot()
    })
  })

  test('the api client configuration is deep merged with the remote app_config extension registrations', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const developerPlatformClient = buildDeveloperPlatformClient()
      const options: LinkOptions = {
        directory: tmp,
        developerPlatformClient,
      }
      const localApp = {
        configuration: {
          name: 'my app',
          client_id: '12345',
          scopes: 'write_products',
          webhooks: {
            api_version: '2023-04',
          },
          application_url: 'https://myapp.com',
          embedded: true,
        },
      }
      // Write actual TOML file so getTomls() finds it and reuses the existing config
      const filePath = joinPath(tmp, 'shopify.app.toml')
      writeFileSync(filePath, 'client_id = "12345"\nname = "my app"')
      await mockLoadOpaqueAppWithApp(tmp, localApp, [], 'current')
      vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue(
        testOrganizationApp({
          apiKey: '12345',
          developerPlatformClient,
        }),
      )
      const remoteConfiguration = {
        ...DEFAULT_REMOTE_CONFIGURATION,
        name: 'my app',
        application_url: 'https://myapp.com',
        access_scopes: {scopes: 'write_products'},
        pos: {embedded: true},
        webhooks: {
          api_version: '2023-07',
          subscriptions: [{topics: ['products/create'], uri: 'https://my-app.com/webhooks'}],
        },
      }
      vi.mocked(fetchAppRemoteConfiguration).mockResolvedValue(remoteConfiguration)

      // When
      await link(options)

      // Then - since client_id matches, the existing shopify.app.toml is reused (no prompt)
      expect(selectConfigName).not.toHaveBeenCalled()
      const content = await readFile(joinPath(tmp, 'shopify.app.toml'))
      expect(content).toMatchSnapshot()
      expect(renderSuccess).toHaveBeenCalledWith({
        headline: 'shopify.app.toml is now linked to "my app" on Shopify',
        body: 'Using shopify.app.toml as your default config.',
        nextSteps: [
          [`Make updates to shopify.app.toml in your local project`],
          ['To upload your config, run', {command: 'yarn shopify app deploy'}],
        ],
        reference: [
          {
            link: {
              label: 'App configuration',
              url: 'https://shopify.dev/docs/apps/tools/cli/configuration',
            },
          },
        ],
      })
    })
  })

  test('when local app doesnt include build section and the remote app is new then include include_config_on_deploy is added', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const filePath = joinPath(tmp, 'shopify.app.toml')
      const initialContent = `scopes = ""
    `
      writeFileSync(filePath, initialContent)
      const developerPlatformClient = buildDeveloperPlatformClient()
      const options: LinkOptions = {
        directory: tmp,
        developerPlatformClient,
      }
      await mockLoadOpaqueAppWithApp(tmp)
      vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue({
        ...mockRemoteApp(),
        newApp: true,
        developerPlatformClient,
      })

      // When
      await link(options)

      // Then
      const content = await readFile(joinPath(tmp, 'shopify.app.toml'))
      expect(content).toMatchSnapshot()
    })
  })

  test('when remote app is new and supports dev sessions then include automatically_update_urls_on_dev = true', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const filePath = joinPath(tmp, 'shopify.app.toml')
      const initialContent = `scopes = ""
    `
      writeFileSync(filePath, initialContent)
      const developerPlatformClient = buildDeveloperPlatformClient({supportsDevSessions: true})
      const options: LinkOptions = {
        directory: tmp,
        developerPlatformClient,
      }
      await mockLoadOpaqueAppWithApp(tmp)
      vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue({
        ...mockRemoteApp(),
        newApp: true,
        developerPlatformClient,
      })

      // When
      await link(options)

      // Then
      const content = await readFile(joinPath(tmp, 'shopify.app.toml'))
      expect(content).toMatchSnapshot()
    })
  })

  test('replace arrays content with the remote one', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const developerPlatformClient = buildDeveloperPlatformClient()
      const options: LinkOptions = {
        directory: tmp,
        developerPlatformClient,
      }
      await mockLoadOpaqueAppWithApp(tmp)
      vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue(mockRemoteApp({developerPlatformClient}))
      const remoteConfiguration = {
        ...DEFAULT_REMOTE_CONFIGURATION,
        auth: {
          redirect_urls: ['https://example.com/remote'],
        },
      }
      vi.mocked(fetchAppRemoteConfiguration).mockResolvedValue(remoteConfiguration)

      // When
      await link(options)

      // Then
      const content = await readFile(joinPath(tmp, 'shopify.app.toml'))
      expect(content).toMatchSnapshot()
    })
  })

  test('write in the toml configuration fields not typed', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const developerPlatformClient = buildDeveloperPlatformClient()
      const options: LinkOptions = {
        directory: tmp,
        developerPlatformClient,
      }
      await mockLoadOpaqueAppWithApp(tmp)
      vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue(mockRemoteApp({developerPlatformClient}))
      const remoteConfiguration = {
        ...DEFAULT_REMOTE_CONFIGURATION,
        handle: 'handle',
      }
      vi.mocked(fetchAppRemoteConfiguration).mockResolvedValue(remoteConfiguration)

      // When
      await link(options)

      // Then
      const content = await readFile(joinPath(tmp, 'shopify.app.toml'))
      expect(content).toMatchSnapshot()
    })
  })

  test('existing config is respected when isNewApp is true, config is current and client_id is not the same as remote app', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const developerPlatformClient = buildDeveloperPlatformClient()
      const options: LinkOptions = {
        directory: tmp,
        developerPlatformClient,
        isNewApp: true,
        configName: 'shopify.app.toml',
      }
      const localApp = {
        configPath: joinPath(tmp, 'shopify.app.toml'),
        configuration: {
          name: 'my app',
          client_id: 'invalid_client_id_from_template',
          webhooks: {
            api_version: '2023-04',
            subscriptions: [{topics: ['products/create'], uri: 'https://my-app.com/webhooks'}],
          },
          application_url: 'https://myapp.com',
          build: {
            automatically_update_urls_on_dev: true,
            dev_store_url: 'my-store.myshopify.com',
            include_config_on_deploy: true,
          },
          access_scopes: {
            scopes: 'write_products',
          },
        } as CurrentAppConfiguration,
      }

      await mockLoadOpaqueAppWithApp(tmp, localApp, [], 'current')
      vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue(mockRemoteApp({developerPlatformClient}))
      const remoteConfiguration = {
        ...DEFAULT_REMOTE_CONFIGURATION,
        handle: 'handle',
      }
      vi.mocked(fetchAppRemoteConfiguration).mockResolvedValue(remoteConfiguration)

      // When
      await link(options)

      // Then
      const content = await readFile(joinPath(tmp, 'shopify.app.toml'))
      expect(content).toMatchSnapshot()
    })
  })

  test('existing config is respected when isNewApp is true, config is current and client_id is not the same as remote app and config name is provided', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const developerPlatformClient = buildDeveloperPlatformClient()
      const options: LinkOptions = {
        directory: tmp,
        developerPlatformClient,
        isNewApp: true,
        configName: 'staging',
      }
      const localApp = {
        configPath: joinPath(tmp, 'shopify.app.staging.toml'),
        configuration: {
          name: 'my app',
          client_id: 'invalid_client_id_from_template',
          webhooks: {
            api_version: '2023-04',
            subscriptions: [{topics: ['products/create'], uri: 'https://my-app.com/webhooks'}],
          },
          application_url: 'https://myapp.com',
          build: {
            automatically_update_urls_on_dev: true,
            dev_store_url: 'my-store.myshopify.com',
            include_config_on_deploy: true,
          },
          access_scopes: {
            scopes: 'write_products',
          },
        } as CurrentAppConfiguration,
      }

      await mockLoadOpaqueAppWithApp(tmp, localApp, [], 'current')
      vi.mocked(fetchOrCreateOrganizationApp).mockResolvedValue(mockRemoteApp({developerPlatformClient}))
      const remoteConfiguration = {
        ...DEFAULT_REMOTE_CONFIGURATION,
        handle: 'handle',
      }
      vi.mocked(fetchAppRemoteConfiguration).mockResolvedValue(remoteConfiguration)

      // When
      await link(options)

      // Then
      const content = await readFile(joinPath(tmp, 'shopify.app.staging.toml'))
      expect(content).toMatchSnapshot()
    })
  })

  test('enables include_config_on_deploy when the apiKey is provided and isNewApp is true', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const developerPlatformClient = buildDeveloperPlatformClient()
      const options: LinkOptions = {
        directory: tmp,
        developerPlatformClient,
        isNewApp: true,
        configName: 'shopify.app.toml',
        apiKey: '1',
      }
      const localApp = {
        configPath: joinPath(tmp, 'shopify.app.toml'),
        configuration: {
          name: 'my app',
          client_id: 'invalid_client_id_from_template',
          webhooks: {
            api_version: '2023-04',
            subscriptions: [{topics: ['products/create'], uri: 'https://my-app.com/webhooks'}],
          },
          application_url: 'https://myapp.com',
          build: {
            automatically_update_urls_on_dev: true,
            dev_store_url: 'my-store.myshopify.com',
          },
          access_scopes: {
            scopes: 'write_products',
          },
        } as CurrentAppConfiguration,
      }

      await mockLoadOpaqueAppWithApp(tmp, localApp, [], 'current')
      vi.mocked(appFromIdentifiers).mockResolvedValue(mockRemoteApp({developerPlatformClient}))
      const remoteConfiguration = {
        ...DEFAULT_REMOTE_CONFIGURATION,
        handle: 'handle',
      }
      vi.mocked(fetchAppRemoteConfiguration).mockResolvedValue(remoteConfiguration)

      // When
      await link(options)

      // Then
      const content = await readFile(joinPath(tmp, 'shopify.app.toml'))
      expect(content).toMatchSnapshot()
    })
  })
})

async function mockApp(
  directory: string,
  app?: Partial<AppInterface>,
  flags = [],
  schemaType: 'current' | 'legacy' = 'legacy',
) {
  const versionSchema = await buildVersionedAppSchema()
  const localApp = testApp(app)
  localApp.configuration.client_id = '12345'
  localApp.configSchema = versionSchema.schema
  localApp.specifications = versionSchema.configSpecifications
  localApp.directory = directory
  setPathValue(localApp, 'remoteFlags', flags)
  return localApp
}

/**
 * Helper to mock loadOpaqueApp with a successful app load result.
 * Call this instead of mocking loadApp directly, as loadLocalAppOptions now uses loadOpaqueApp.
 */
async function mockLoadOpaqueAppWithApp(
  directory: string,
  app?: Partial<AppInterface>,
  flags = [],
  schemaType: 'current' | 'legacy' = 'legacy',
) {
  const mockedApp = await mockApp(directory, app, flags, schemaType)
  vi.mocked(loadOpaqueApp).mockResolvedValue({
    state: 'loaded-app',
    app: mockedApp,
    configuration: mockedApp.configuration,
    packageManager: 'yarn',
  })
  // Also mock loadApp for backward compatibility with getAppCreationDefaultsFromLocalApp
  vi.mocked(loadApp).mockResolvedValue(mockedApp)
}

/**
 * Helper to mock loadOpaqueApp with an error state (app couldn't be loaded).
 */
function mockLoadOpaqueAppWithError() {
  vi.mocked(loadOpaqueApp).mockResolvedValue({state: 'error'})
  vi.mocked(loadApp).mockRejectedValue(new Error('App not found'))
}

function mockRemoteApp(extraRemoteAppFields: Partial<OrganizationApp> = {}) {
  const remoteApp = testOrganizationApp()
  remoteApp.apiKey = '12345'
  return {...remoteApp, ...extraRemoteAppFields}
}
