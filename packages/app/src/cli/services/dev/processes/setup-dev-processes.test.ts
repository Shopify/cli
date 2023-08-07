import {DevConfig, ProxyServerProcess, setupDevProcesses, startProxyServer} from './setup-dev-processes.js'
import {SendWebhookProcess, sendWebhook} from './uninstall-webhook.js'
import {WebProcess} from './web.js'
import {PreviewableExtensionProcess, launchPreviewableExtensionProcess} from './previewable-extension.js'
import {DraftableExtensionProcess, pushUpdatesForDraftableExtensions} from './draftable-extension.js'
import {PreviewThemeAppExtensionsProcess, runThemeAppExtensionsServer} from './theme-app-extension.js'
import {
  testAppWithConfig,
  testTaxCalculationExtension,
  testThemeExtensions,
  testUIExtension,
} from '../../../models/app/app.test-data.js'
import {launchWebProcess} from '../../dev.js'
import {WebType} from '../../../models/app/app.js'
import {ensureDeploymentIdsPresence} from '../../context/identifiers.js'
import {fetchAppExtensionRegistrations} from '../fetch.js'
import {describe, test, expect, beforeEach, vi} from 'vitest'
import {ensureAuthenticatedAdmin, ensureAuthenticatedStorefront} from '@shopify/cli-kit/node/session'

vi.mock('../../context/identifiers.js')
vi.mock('@shopify/cli-kit/node/session.js')
vi.mock('../fetch.js')

beforeEach(() => {
  // mocked for draft extensions
  vi.mocked(ensureDeploymentIdsPresence).mockResolvedValue({extensionIds: {}, app: 'app-id', extensions: {}})

  // mocked for theme app extensions
  vi.mocked(ensureAuthenticatedAdmin).mockResolvedValue({
    storeFqdn: 'store.myshopify.io',
    token: 'admin-token',
  })
  vi.mocked(ensureAuthenticatedStorefront).mockResolvedValue('storefront-token')
  vi.mocked(fetchAppExtensionRegistrations).mockResolvedValue({
    app: {
      extensionRegistrations: [
        {
          type: 'THEME_APP_EXTENSION',
          id: '123',
          uuid: '123',
          title: 'mock-theme',
        },
      ],
      dashboardManagedExtensionRegistrations: [],
      functions: [],
    },
  })
})

describe('setup-dev-processes', () => {
  test('can create a process list', async () => {
    const token = 'token'
    const storeFqdn = 'store.myshopify.io'
    const usesUnifiedDeployment = true
    const remoteAppUpdated = true
    const commandOptions = {
      subscriptionProductUrl: '/products/999999',
      checkoutCartUrl: '/cart/999999:1',
      theme: '1',
    }
    const network: DevConfig['network'] = {
      backendPort: 111,
      frontendPort: 222,
      frontendServerPort: 333,
      exposedUrl: 'https://example.com/exposed',
      frontendUrl: 'https://example.com/frontend',
      proxyPort: 444,
      proxyUrl: 'https://example.com/proxy',
      usingLocalhost: false,
      currentUrls: {
        applicationUrl: 'https://example.com/application',
        redirectUrlWhitelist: ['https://example.com/redirect'],
      },
    }
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
      },
    })

    const previewable = await testUIExtension({type: 'checkout_ui_extension'})
    localApp.allExtensions.push(previewable)

    const draftable = await testTaxCalculationExtension()
    localApp.allExtensions.push(draftable)

    const theme = await testThemeExtensions()
    localApp.allExtensions.push(theme)

    const remoteApp: DevConfig['remoteApp'] = {
      apiKey: 'api-key',
      apiSecret: 'api-secret',
      id: '1234',
      title: 'App',
      organizationId: '5678',
      grantedScopes: [],
      applicationUrl: 'https://example.com/application',
      redirectUrlWhitelist: [],
    }

    const res = await setupDevProcesses({
      localApp,
      commandOptions,
      network,
      remoteApp,
      remoteAppUpdated,
      storeFqdn,
      token,
      usesUnifiedDeployment,
    })

    expect(res.previewUrl).toBe('https://example.com/proxy/extensions/dev-console')
    expect(res.processes).toEqual([
      {
        type: 'web',
        prefix: 'web-backend-frontend',
        function: launchWebProcess,
        options: {
          apiKey: 'api-key',
          apiSecret: 'api-secret',
          backendPort: 111,
          devCommand: 'npm exec remix dev',
          directory: 'web',
          frontendServerPort: 333,
          hmrServerOptions: {
            port: expect.any(Number),
            httpPaths: ['/ping'],
          },
          port: expect.any(Number),
          hostname: 'https://example.com/frontend',
          scopes: 'read_products',
        },
      } as WebProcess,
      {
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
      } as PreviewableExtensionProcess,
      {
        type: 'draftable-extension',
        prefix: 'extensions',
        function: pushUpdatesForDraftableExtensions,
        options: {
          unifiedDeployment: true,
          localApp,
          apiKey: 'api-key',
          token,
          extensions: [draftable],
          remoteExtensionIds: {},
          proxyUrl: 'https://example.com/proxy',
        },
      } as DraftableExtensionProcess,
      {
        type: 'theme-app-extensions',
        prefix: 'extensions',
        function: runThemeAppExtensionsServer,
        options: {
          adminSession: {
            storeFqdn: 'store.myshopify.io',
            token: 'admin-token',
          },
          themeExtensionServerArgs:
            './my-extension --api-key api-key --extension-id 123 --extension-title theme-extension-name --extension-type THEME_APP_EXTENSION --theme 1'.split(
              ' ',
            ),
          storefrontToken: 'storefront-token',
          usesUnifiedDeployment: true,
          token,
        },
      } as PreviewThemeAppExtensionsProcess,
      {
        type: 'send-webhook',
        prefix: 'webhooks',
        function: sendWebhook,
        options: {
          apiSecret: 'api-secret',
          deliveryPort: 111,
          storeFqdn: 'store.myshopify.io',
          token: 'token',
          webhooksPath: '/webhooks',
        },
      } as SendWebhookProcess,
      {
        type: 'proxy-server',
        prefix: 'proxy',
        function: startProxyServer,
        options: {
          port: 444,
          rules: {
            '/extensions': expect.stringMatching(/http:\/\/localhost:\d+/),
            '/ping': expect.stringMatching(/http:\/\/localhost:\d+/),
            default: expect.stringMatching(/http:\/\/localhost:\d+/),
            websocket: expect.stringMatching(/http:\/\/localhost:\d+/),
          },
        },
      } as ProxyServerProcess,
    ])

    // Check the ports & rule mapping
    const webPort = (res.processes[0] as WebProcess).options.port
    const hmrPort = (res.processes[0] as WebProcess).options.hmrServerOptions?.port
    const previewExtensionPort = (res.processes[1] as PreviewableExtensionProcess).options.port
    expect((res.processes[5] as ProxyServerProcess).options.rules).toEqual({
      '/extensions': `http://localhost:${previewExtensionPort}`,
      '/ping': `http://localhost:${hmrPort}`,
      default: `http://localhost:${webPort}`,
      websocket: `http://localhost:${hmrPort}`,
    })
  })
})
