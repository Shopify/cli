import {DevConfig, setupDevProcesses, startProxyServer} from './setup-dev-processes.js'
import {subscribeAndStartPolling} from './app-logs-polling.js'
import {sendWebhook} from './uninstall-webhook.js'
import {WebProcess, launchWebProcess} from './web.js'
import {PreviewableExtensionProcess, launchPreviewableExtensionProcess} from './previewable-extension.js'
import {launchGraphiQLServer} from './graphiql.js'
import {pushUpdatesForDraftableExtensions} from './draftable-extension.js'
import {pushUpdatesForDevSession} from './dev-session.js'
import {runThemeAppExtensionsServer} from './theme-app-extension.js'
import {
  testAppAccessConfigExtension,
  testAppConfigExtensions,
  testAppWithConfig,
  testDeveloperPlatformClient,
  testSingleWebhookSubscriptionExtension,
  testTaxCalculationExtension,
  testThemeExtensions,
  testUIExtension,
  testFunctionExtension,
  testWebhookExtensions,
  testOrganizationApp,
  testAppLinked,
  testOrganization,
  testOrganizationStore,
} from '../../../models/app/app.test-data.js'
import {WebType} from '../../../models/app/app.js'
import {ensureDeploymentIdsPresence} from '../../context/identifiers.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {describe, test, expect, beforeEach, vi} from 'vitest'
import {ensureAuthenticatedAdmin, ensureAuthenticatedStorefront} from '@shopify/cli-kit/node/session'
import {Config} from '@oclif/core'
import {getEnvironmentVariables} from '@shopify/cli-kit/node/environment'
import {isStorefrontPasswordProtected} from '@shopify/theme'
import {fetchTheme} from '@shopify/cli-kit/node/themes/api'

vi.mock('../../context/identifiers.js')
vi.mock('@shopify/cli-kit/node/session.js')
vi.mock('../fetch.js')
vi.mock('@shopify/cli-kit/node/environment')
vi.mock('@shopify/theme')
vi.mock('@shopify/cli-kit/node/themes/api')
beforeEach(() => {
  // mocked for draft extensions
  vi.mocked(ensureDeploymentIdsPresence).mockResolvedValue({
    extensionIds: {},
    app: 'app-id',
    extensions: {},
    extensionsNonUuidManaged: {},
  })

  // mocked for theme app extensions
  vi.mocked(ensureAuthenticatedAdmin).mockResolvedValue({
    storeFqdn: 'store.myshopify.io',
    token: 'admin-token',
  })
  vi.mocked(ensureAuthenticatedStorefront).mockResolvedValue('storefront-token')
  vi.mocked(getEnvironmentVariables).mockReturnValue({})
  vi.mocked(isStorefrontPasswordProtected).mockResolvedValue(false)
  vi.mocked(fetchTheme).mockResolvedValue({
    id: 1,
    name: 'Theme',
    createdAtRuntime: false,
    role: 'theme',
    processing: false,
  })
})

const appContextResult = {
  app: testAppLinked(),
  remoteApp: testOrganizationApp(),
  developerPlatformClient: testDeveloperPlatformClient(),
  organization: testOrganization(),
  store: testOrganizationStore({}),
  specifications: [],
}

describe('setup-dev-processes', () => {
  test('can create a process list', async () => {
    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient()
    const storeFqdn = 'store.myshopify.io'
    const storeId = '123456789'
    const remoteAppUpdated = true
    const graphiqlPort = 1234
    const commandOptions: DevConfig['commandOptions'] = {
      ...appContextResult,
      subscriptionProductUrl: '/products/999999',
      checkoutCartUrl: '/cart/999999:1',
      theme: '1',
      directory: '',
      update: false,
      commandConfig: new Config({root: ''}),
      skipDependenciesInstallation: false,
      noTunnel: false,
    }
    const network: DevConfig['network'] = {
      proxyUrl: 'https://example.com/proxy',
      proxyPort: 444,
      backendPort: 111,
      frontendPort: 222,
      currentUrls: {
        applicationUrl: 'https://example.com/application',
        redirectUrlWhitelist: ['https://example.com/redirect'],
      },
    }
    const previewable = await testUIExtension({type: 'checkout_ui_extension'})
    const draftable = await testTaxCalculationExtension()
    const theme = await testThemeExtensions()
    const localApp = testAppWithConfig({
      config: {},
      app: {
        webs: [
          {
            directory: 'web',
            configuration: {
              roles: [WebType.Backend, WebType.Frontend],
              commands: {dev: 'npm exec remix dev'},
              webhooks_path: '/webhooks',
              hmr_server: {
                http_paths: ['/ping'],
              },
            },
          },
        ],
        allExtensions: [previewable, draftable, theme],
      },
    })

    const remoteApp: DevConfig['remoteApp'] = {
      apiKey: 'api-key',
      apiSecretKeys: [{secret: 'api-secret'}],
      id: '1234',
      title: 'App',
      organizationId: '5678',
      grantedScopes: [],
      flags: [],
    }

    const graphiqlKey = 'somekey'

    const res = await setupDevProcesses({
      localApp,
      commandOptions,
      network,
      remoteApp,
      remoteAppUpdated,
      storeFqdn,
      storeId,
      developerPlatformClient,
      partnerUrlsUpdated: true,
      graphiqlPort,
      graphiqlKey,
    })

    expect(res.previewUrl).toBe('https://example.com/proxy/extensions/dev-console')
    expect(res.processes[0]).toMatchObject({
      type: 'web',
      prefix: 'web-backend-frontend',
      function: launchWebProcess,
      options: {
        apiKey: 'api-key',
        apiSecret: 'api-secret',
        backendPort: 111,
        devCommand: 'npm exec remix dev',
        directory: 'web',
        frontendServerPort: 222,
        hmrServerOptions: {
          port: expect.any(Number),
          httpPaths: ['/ping'],
        },
        port: expect.any(Number),
        hostname: 'https://example.com/proxy',
        scopes: 'read_products',
      },
    })
    expect(res.processes[1]).toMatchObject({
      type: 'graphiql',
      function: launchGraphiQLServer,
      prefix: 'graphiql',
      options: {
        appName: 'App',
        apiKey: 'api-key',
        apiSecret: 'api-secret',
        port: expect.any(Number),
        appUrl: 'https://store.myshopify.io/admin/oauth/redirect_from_cli?client_id=api-key',
        key: 'somekey',
        storeFqdn: 'store.myshopify.io',
      },
    })
    expect(res.processes[2]).toMatchObject({
      type: 'previewable-extension',
      function: launchPreviewableExtensionProcess,
      prefix: 'extensions',
      options: {
        apiKey: 'api-key',
        previewableExtensions: [previewable],
        storeFqdn,
        proxyUrl: 'https://example.com/proxy',
        port: expect.any(Number),
        pathPrefix: '/extensions',
        appDirectory: '/tmp/project',
        appName: 'App',
        subscriptionProductUrl: '/products/999999',
        cartUrl: '/cart/999999:1',
        grantedScopes: [],
        appId: '1234',
      },
    })
    expect(res.processes[3]).toMatchObject({
      type: 'draftable-extension',
      prefix: 'extensions',
      function: pushUpdatesForDraftableExtensions,
      options: {
        localApp,
        apiKey: 'api-key',
        developerPlatformClient,
        extensions: expect.arrayContaining([draftable]),
        remoteExtensionIds: {},
        proxyUrl: 'https://example.com/proxy',
      },
    })
    expect(res.processes[4]).toMatchObject({
      type: 'theme-app-extensions',
      prefix: 'theme-extensions',
      function: runThemeAppExtensionsServer,
      options: {
        theme: {
          id: 1,
          name: 'Theme',
          createdAtRuntime: false,
          role: 'theme',
          processing: false,
        },
        adminSession: {
          storeFqdn: 'store.myshopify.io',
          token: 'admin-token',
        },
        themeExtensionDirectory: './my-extension',
        themeExtensionPort: 9293,
      },
    })
    expect(res.processes[5]).toMatchObject({
      type: 'send-webhook',
      prefix: 'webhooks',
      function: sendWebhook,
      options: {
        apiSecret: 'api-secret',
        deliveryPort: 111,
        storeFqdn: 'store.myshopify.io',
        developerPlatformClient,
        webhooksPath: '/webhooks',
      },
    })

    // Check the ports & rule mapping
    const webPort = (res.processes[0] as WebProcess).options.port
    const hmrPort = (res.processes[0] as WebProcess).options.hmrServerOptions?.port
    const previewExtensionPort = (res.processes[2] as PreviewableExtensionProcess).options.port

    expect(res.processes[6]).toMatchObject({
      type: 'proxy-server',
      prefix: 'proxy',
      function: startProxyServer,
      options: {
        port: 444,
        rules: {
          '/extensions': `http://localhost:${previewExtensionPort}`,
          '/ping': `http://localhost:${hmrPort}`,
          default: `http://localhost:${webPort}`,
          websocket: `http://localhost:${hmrPort}`,
        },
      },
    })
  })

  test('process list includes dev-session when useDevSession is true', async () => {
    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient({supportsDevSessions: true})
    const storeFqdn = 'store.myshopify.io'
    const storeId = '123456789'
    const remoteAppUpdated = true
    const graphiqlPort = 1234
    const commandOptions: DevConfig['commandOptions'] = {
      ...appContextResult,
      directory: '',
      update: false,
      commandConfig: new Config({root: ''}),
      skipDependenciesInstallation: false,
      noTunnel: false,
    }
    const network: DevConfig['network'] = {
      proxyUrl: 'https://example.com/proxy',
      proxyPort: 444,
      backendPort: 111,
      frontendPort: 222,
      currentUrls: {
        applicationUrl: 'https://example.com/application',
        redirectUrlWhitelist: ['https://example.com/redirect'],
      },
    }
    const localApp = testAppWithConfig()

    const remoteApp: DevConfig['remoteApp'] = {
      apiKey: 'api-key',
      apiSecretKeys: [{secret: 'api-secret'}],
      id: '1234',
      title: 'App',
      organizationId: '5678',
      grantedScopes: [],
      flags: [],
    }

    const res = await setupDevProcesses({
      localApp,
      commandOptions,
      network,
      remoteApp,
      remoteAppUpdated,
      storeFqdn,
      storeId,
      developerPlatformClient,
      partnerUrlsUpdated: true,
      graphiqlPort,
      graphiqlKey: 'somekey',
    })

    expect(res.processes[2]).toMatchObject({
      type: 'dev-session',
      prefix: 'dev-session',
      function: pushUpdatesForDevSession,
      options: {
        app: localApp,
        apiKey: 'api-key',
        developerPlatformClient,
        url: 'https://example.com/proxy',
        appId: '1234',
        organizationId: '5678',
        storeFqdn: 'store.myshopify.io',
      },
    })
  })

  test('process list includes app polling when envVar is enabled and functions are available', async () => {
    vi.mocked(getEnvironmentVariables).mockReturnValue({SHOPIFY_CLI_ENABLE_APP_LOG_POLLING: '1'})

    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient()
    const storeFqdn = 'store.myshopify.io'
    const storeId = '123456789'
    const remoteAppUpdated = true
    const graphiqlPort = 1234
    const commandOptions: DevConfig['commandOptions'] = {
      ...appContextResult,
      subscriptionProductUrl: '/products/999999',
      checkoutCartUrl: '/cart/999999:1',
      theme: '1',
      directory: '',
      update: false,
      commandConfig: new Config({root: ''}),
      skipDependenciesInstallation: false,
      noTunnel: false,
    }
    const network: DevConfig['network'] = {
      proxyUrl: 'https://example.com/proxy',
      proxyPort: 444,
      backendPort: 111,
      frontendPort: 222,
      currentUrls: {
        applicationUrl: 'https://example.com/application',
        redirectUrlWhitelist: ['https://example.com/redirect'],
      },
    }
    const functionExtension = await testFunctionExtension()
    const previewable = await testUIExtension({type: 'checkout_ui_extension'})
    const draftable = await testTaxCalculationExtension()
    const theme = await testThemeExtensions()
    const localApp = testAppWithConfig({
      config: {},
      app: {
        webs: [
          {
            directory: 'web',
            configuration: {
              roles: [WebType.Backend, WebType.Frontend],
              commands: {dev: 'npm exec remix dev'},
              webhooks_path: '/webhooks',
              hmr_server: {
                http_paths: ['/ping'],
              },
            },
          },
        ],
        allExtensions: [previewable, draftable, theme, functionExtension],
      },
    })

    const remoteApp: DevConfig['remoteApp'] = {
      apiKey: 'api-key',
      apiSecretKeys: [{secret: 'api-secret'}],
      id: '1234',
      title: 'App',
      organizationId: '5678',
      grantedScopes: [],
      flags: [],
    }

    const graphiqlKey = 'somekey'

    const res = await setupDevProcesses({
      localApp,
      commandOptions,
      network,
      remoteApp,
      remoteAppUpdated,
      storeFqdn,
      storeId,
      developerPlatformClient,
      partnerUrlsUpdated: true,
      graphiqlPort,
      graphiqlKey,
    })

    expect(res.processes[6]).toMatchObject({
      type: 'app-logs-subscribe',
      prefix: 'app-logs',
      function: subscribeAndStartPolling,
      options: {
        developerPlatformClient,
        appLogsSubscribeVariables: {
          shopIds: ['123456789'],
          apiKey: 'api-key',
          token: 'token',
        },
      },
    })
  })

  test('process list skips app polling when envVar is enabled but no functions are registered on the app', async () => {
    vi.mocked(getEnvironmentVariables).mockReturnValue({SHOPIFY_CLI_ENABLE_APP_LOG_POLLING: '1'})

    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient()
    const storeFqdn = 'store.myshopify.io'
    const storeId = '123456789'
    const remoteAppUpdated = true
    const graphiqlPort = 1234
    const commandOptions: DevConfig['commandOptions'] = {
      ...appContextResult,
      subscriptionProductUrl: '/products/999999',
      checkoutCartUrl: '/cart/999999:1',
      theme: '1',
      directory: '',
      update: false,
      commandConfig: new Config({root: ''}),
      skipDependenciesInstallation: false,
      noTunnel: false,
    }
    const network: DevConfig['network'] = {
      proxyUrl: 'https://example.com/proxy',
      proxyPort: 444,
      backendPort: 111,
      frontendPort: 222,
      currentUrls: {
        applicationUrl: 'https://example.com/application',
        redirectUrlWhitelist: ['https://example.com/redirect'],
      },
    }

    const previewable = await testUIExtension({type: 'checkout_ui_extension'})
    const draftable = await testTaxCalculationExtension()
    const theme = await testThemeExtensions()
    const localApp = testAppWithConfig({
      config: {},
      app: {
        webs: [
          {
            directory: 'web',
            configuration: {
              roles: [WebType.Backend, WebType.Frontend],
              commands: {dev: 'npm exec remix dev'},
              webhooks_path: '/webhooks',
              hmr_server: {
                http_paths: ['/ping'],
              },
            },
          },
        ],
        allExtensions: [previewable, draftable, theme],
      },
    })

    const remoteApp: DevConfig['remoteApp'] = {
      apiKey: 'api-key',
      apiSecretKeys: [{secret: 'api-secret'}],
      id: '1234',
      title: 'App',
      organizationId: '5678',
      grantedScopes: [],
      flags: [],
    }

    const graphiqlKey = 'somekey'

    const res = await setupDevProcesses({
      localApp,
      commandOptions,
      network,
      remoteApp,
      remoteAppUpdated,
      storeFqdn,
      storeId,
      developerPlatformClient,
      partnerUrlsUpdated: true,
      graphiqlPort,
      graphiqlKey,
    })

    res.processes.forEach((process) => {
      expect(process.type).not.toBe('app-logs-subscribe')
    })
  })

  test('pushUpdatesForDraftableExtensions does not include config extensions except app_access', async () => {
    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient()
    const storeFqdn = 'store.myshopify.io'
    const storeId = '123456789'
    const remoteAppUpdated = true
    const graphiqlPort = 1234
    const commandOptions: DevConfig['commandOptions'] = {
      ...appContextResult,
      subscriptionProductUrl: '/products/999999',
      checkoutCartUrl: '/cart/999999:1',
      theme: '1',
      directory: '',
      update: false,
      commandConfig: new Config({root: ''}),
      skipDependenciesInstallation: false,
      noTunnel: false,
    }
    const network: DevConfig['network'] = {
      proxyUrl: 'https://example.com/proxy',
      proxyPort: 444,
      backendPort: 111,
      frontendPort: 222,
      currentUrls: {
        applicationUrl: 'https://example.com/application',
        redirectUrlWhitelist: ['https://example.com/redirect'],
      },
    }
    const previewable = await testUIExtension({type: 'checkout_ui_extension'})
    const draftable = await testTaxCalculationExtension()
    const nonDraftableSingleUidStrategyExtension = await testAppConfigExtensions()
    const draftableSingleUidStrategyExtension = await testAppAccessConfigExtension()
    const webhookSubscriptionModuleExtension = await testSingleWebhookSubscriptionExtension()
    const webhooksModuleExtension = await testWebhookExtensions()
    const theme = await testThemeExtensions()
    const localApp = testAppWithConfig({
      config: {},
      app: {
        webs: [
          {
            directory: 'web',
            configuration: {
              roles: [WebType.Backend, WebType.Frontend],
              commands: {dev: 'npm exec remix dev'},
              webhooks_path: '/webhooks',
              hmr_server: {
                http_paths: ['/ping'],
              },
            },
          },
        ],
        allExtensions: [
          previewable,
          draftable,
          theme,
          nonDraftableSingleUidStrategyExtension,
          draftableSingleUidStrategyExtension,
          webhookSubscriptionModuleExtension,
          webhooksModuleExtension,
        ],
      },
    })

    const remoteApp: DevConfig['remoteApp'] = {
      apiKey: 'api-key',
      apiSecretKeys: [{secret: 'api-secret'}],
      id: '1234',
      title: 'App',
      organizationId: '5678',
      grantedScopes: [],
      flags: [],
    }

    const graphiqlKey = 'somekey'

    const res = await setupDevProcesses({
      localApp,
      commandOptions,
      network,
      remoteApp,
      remoteAppUpdated,
      storeFqdn,
      storeId,
      developerPlatformClient,
      partnerUrlsUpdated: true,
      graphiqlPort,
      graphiqlKey,
    })

    expect(res.processes[3]).toMatchObject({
      type: 'draftable-extension',
      prefix: 'extensions',
      function: pushUpdatesForDraftableExtensions,
      options: {
        localApp,
        apiKey: 'api-key',
        developerPlatformClient,
        extensions: expect.arrayContaining([draftable, theme, previewable, draftableSingleUidStrategyExtension]),
        remoteExtensionIds: {},
        proxyUrl: 'https://example.com/proxy',
      },
    })
  })
})
