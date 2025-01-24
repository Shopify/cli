import {DevConfig, setupDevProcesses} from './setup-dev-processes.js'
import {subscribeAndStartPolling} from './app-logs-polling.js'
import {pushUpdatesForDevSession} from './dev-session.js'
import {
  testAppWithConfig,
  testDeveloperPlatformClient,
  testTaxCalculationExtension,
  testThemeExtensions,
  testUIExtension,
  testFunctionExtension,
  testOrganizationApp,
  testAppLinked,
  testOrganization,
  testOrganizationStore,
} from '../../../models/app/app.test-data.js'
import {WebType} from '../../../models/app/app.js'
import {ensureDeploymentIdsPresence} from '../../context/identifiers.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import * as loader from '../../../models/app/loader.js'
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
  test('process list includes dev-session when useDevSession is true', async () => {
    const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient()
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
    vi.spyOn(loader, 'reloadApp').mockResolvedValue(localApp)

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
    vi.spyOn(loader, 'reloadApp').mockResolvedValue(localApp)

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

    vi.spyOn(loader, 'reloadApp').mockResolvedValue(localApp)

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
      graphiqlPort,
      graphiqlKey,
    })

    res.processes.forEach((process) => {
      expect(process.type).not.toBe('app-logs-subscribe')
    })
  })
})
