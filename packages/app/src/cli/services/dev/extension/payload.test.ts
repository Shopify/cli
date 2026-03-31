import {UIExtensionPayload} from './payload/models.js'
import {getUIExtensionPayload} from './payload.js'
import {ExtensionsPayloadStoreOptions} from './payload/store.js'
import {testUIExtension} from '../../../models/app/app.test-data.js'
import * as appModel from '../../../models/app/app.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {inTemporaryDirectory, mkdir, touchFile, writeFile} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'

describe('getUIExtensionPayload', () => {
  beforeEach(() => {
    vi.spyOn(appModel, 'getUIExtensionRendererVersion').mockResolvedValue({
      name: 'extension-renderer',
      version: '1.2.3',
    })
  })

  function createMockOptions(tmpDir: string, extensions: any[]): Omit<ExtensionsPayloadStoreOptions, 'appWatcher'> {
    return {
      signal: vi.fn() as any,
      stdout: vi.fn() as any,
      stderr: vi.fn() as any,
      apiKey: 'api-key',
      appName: 'foobar',
      appDirectory: '/tmp',
      extensions,
      grantedScopes: ['scope-a'],
      port: 123,
      url: 'http://tunnel-url.com',
      storeFqdn: 'my-domain.com',
      storeId: '123456789',
      buildDirectory: tmpDir,
      checkoutCartUrl: 'https://my-domain.com/cart',
      subscriptionProductUrl: 'https://my-domain.com/subscription',
      manifestVersion: '3',
      websocketURL: 'wss://mock.url/extensions',
    }
  }

  async function setupBuildOutput(
    extension: any,
    bundlePath: string,
    manifest: Record<string, unknown>,
    sourceFiles: Record<string, string>,
  ) {
    const extensionOutputPath = extension.getOutputPathForDirectory(bundlePath)
    const buildDir = dirname(extensionOutputPath)
    await mkdir(buildDir)
    await touchFile(extensionOutputPath)
    await writeFile(joinPath(buildDir, 'manifest.json'), JSON.stringify(manifest))

    for (const [filepath, content] of Object.entries(sourceFiles)) {
      const fullPath = joinPath(extension.directory, filepath)
      // eslint-disable-next-line no-await-in-loop
      await mkdir(dirname(fullPath))
      // eslint-disable-next-line no-await-in-loop
      await writeFile(fullPath, content)
    }
  }

  test('returns the right payload', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const outputPath = joinPath(tmpDir, 'test-ui-extension.js')
      await touchFile(outputPath)

      const uiExtension = await testUIExtension({
        outputPath,
        directory: tmpDir,
        configuration: {
          name: 'test-ui-extension',
          type: 'checkout_ui_extension',
          metafields: [],
          capabilities: {
            network_access: true,
            api_access: true,
            block_progress: false,
            collect_buyer_consent: {
              sms_marketing: false,
              customer_privacy: false,
            },
            iframe: {
              sources: ['https://my-iframe.com'],
            },
          },
          extension_points: ['CUSTOM_EXTENSION_POINT'],
        },
        devUUID: 'devUUID',
      })

      const got = await getUIExtensionPayload(uiExtension, 'mock-bundle-path', {
        ...createMockOptions(tmpDir, [uiExtension]),
        currentDevelopmentPayload: {hidden: true, status: 'success'},
      })

      expect(got).toMatchObject({
        assets: {
          main: {
            lastUpdated: expect.any(Number),
            name: 'main',
            url: 'http://tunnel-url.com/extensions/devUUID/assets/test-ui-extension.js',
          },
        },
        capabilities: {
          blockProgress: false,
          networkAccess: true,
          apiAccess: true,
          collectBuyerConsent: {
            smsMarketing: false,
          },
          iframe: {
            sources: ['https://my-iframe.com'],
          },
        },
        development: {
          hidden: true,
          localizationStatus: '',
          resource: {url: 'https://my-domain.com/cart'},
          root: {url: 'http://tunnel-url.com/extensions/devUUID'},
          status: 'success',
        },
        extensionPoints: ['CUSTOM_EXTENSION_POINT'],
        externalType: 'checkout_ui_extension_external',
        localization: null,
        metafields: null,
        surface: 'test-surface',
        title: 'test-ui-extension',
        type: 'checkout_ui_extension',
        uuid: 'devUUID',
        version: '1.2.3',
        approvalScopes: ['scope-a'],
      })
    })
  })

  test('maps tools and instructions from manifest.json to asset payloads', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const uiExtension = await testUIExtension({
        directory: tmpDir,
        configuration: {
          name: 'test-ui-extension',
          type: 'ui_extension',
          extension_points: [
            {
              target: 'CUSTOM_EXTENSION_POINT',
              module: './src/ExtensionPointA.js',
              tools: './tools.json',
              instructions: './instructions.md',
            },
          ],
        },
        devUUID: 'devUUID',
      })

      await setupBuildOutput(
        uiExtension,
        tmpDir,
        {CUSTOM_EXTENSION_POINT: {tools: 'tools.json', instructions: 'instructions.md'}},
        {'tools.json': '{"tools": []}', 'instructions.md': '# Instructions'},
      )

      const got = await getUIExtensionPayload(uiExtension, tmpDir, {
        ...createMockOptions(tmpDir, [uiExtension]),
        currentDevelopmentPayload: {hidden: true, status: 'success'},
      })

      expect(got.extensionPoints).toMatchObject([
        {
          target: 'CUSTOM_EXTENSION_POINT',
          assets: {
            tools: {
              name: 'tools',
              url: 'http://tunnel-url.com/extensions/devUUID/assets/tools.json',
              lastUpdated: expect.any(Number),
            },
            instructions: {
              name: 'instructions',
              url: 'http://tunnel-url.com/extensions/devUUID/assets/instructions.md',
              lastUpdated: expect.any(Number),
            },
          },
        },
      ])
    })
  })

  test('maps intents from manifest.json to asset payloads', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const uiExtension = await testUIExtension({
        directory: tmpDir,
        configuration: {
          name: 'test-ui-extension',
          type: 'ui_extension',
          extension_points: [
            {
              target: 'CUSTOM_EXTENSION_POINT',
              module: './src/ExtensionPointA.js',
              intents: [
                {type: 'application/email', action: 'create', schema: './intents/create-schema.json'},
                {type: 'application/email', action: 'update', schema: './intents/update-schema.json'},
              ],
            },
          ],
        },
        devUUID: 'devUUID',
      })

      await setupBuildOutput(
        uiExtension,
        tmpDir,
        {CUSTOM_EXTENSION_POINT: {intents: [{schema: 'create-schema.json'}, {schema: 'update-schema.json'}]}},
        {'intents/create-schema.json': '{"type": "object"}', 'intents/update-schema.json': '{"type": "object"}'},
      )

      const got = await getUIExtensionPayload(uiExtension, tmpDir, {
        ...createMockOptions(tmpDir, [uiExtension]),
        currentDevelopmentPayload: {hidden: true, status: 'success'},
      })

      expect(got.extensionPoints).toMatchObject([
        {
          target: 'CUSTOM_EXTENSION_POINT',
          intents: [
            {
              type: 'application/email',
              action: 'create',
              schema: {
                name: 'schema',
                url: 'http://tunnel-url.com/extensions/devUUID/assets/intents/create-schema.json',
                lastUpdated: expect.any(Number),
              },
            },
            {
              type: 'application/email',
              action: 'update',
              schema: {
                name: 'schema',
                url: 'http://tunnel-url.com/extensions/devUUID/assets/intents/update-schema.json',
                lastUpdated: expect.any(Number),
              },
            },
          ],
        },
      ])
    })
  })

  test('returns the right payload for post-purchase extensions', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const outputPath = joinPath(tmpDir, 'test-post-purchase-extension.js')
      await touchFile(outputPath)

      const postPurchaseExtension = await testUIExtension({
        outputPath,
        directory: tmpDir,
        configuration: {
          name: 'test-post-purchase-extension',
          type: 'checkout_post_purchase',
          metafields: [],
          capabilities: {
            network_access: true,
            api_access: true,
            block_progress: false,
            collect_buyer_consent: {
              sms_marketing: false,
              customer_privacy: false,
            },
            iframe: {
              sources: ['https://my-iframe.com'],
            },
          },
          extension_points: [{target: 'CUSTOM_EXTENSION_POINT'}],
        },
        devUUID: 'devUUID',
      })

      const got = await getUIExtensionPayload(postPurchaseExtension, 'mock-bundle-path', {
        ...createMockOptions(tmpDir, [postPurchaseExtension]),
        currentDevelopmentPayload: {hidden: true, status: 'success'},
      })

      expect(got).toMatchObject({
        assets: {
          main: {
            lastUpdated: expect.any(Number),
            name: 'main',
            url: 'http://tunnel-url.com/extensions/devUUID/assets/test-post-purchase-extension.js',
          },
        },
        development: {
          hidden: true,
          status: 'success',
        },
        extensionPoints: [{target: 'purchase.post.render'}],
        type: 'checkout_post_purchase',
        uuid: 'devUUID',
      })
    })
  })

  test('default values', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const uiExtension = await testUIExtension({directory: tmpDir})

      const got = await getUIExtensionPayload(uiExtension, 'mock-bundle-path', {
        ...({} as ExtensionsPayloadStoreOptions),
        currentDevelopmentPayload: {},
      })

      expect(got).toMatchObject({
        development: {hidden: false},
        capabilities: {
          blockProgress: false,
          networkAccess: false,
          apiAccess: false,
          collectBuyerConsent: {smsMarketing: false},
          iframe: {sources: []},
        },
      })
    })
  })

  describe('supportedFeatures', () => {
    test('returns runsOffline true when runs_offline is enabled', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const uiExtension = await testUIExtension({
          directory: tmpDir,
          configuration: {
            name: 'test-extension',
            type: 'ui_extension',
            metafields: [],
            capabilities: {},
            supported_features: {runs_offline: true},
            extension_points: [],
          },
        })

        const got = await getUIExtensionPayload(uiExtension, 'mock-bundle-path', {
          ...({} as ExtensionsPayloadStoreOptions),
          currentDevelopmentPayload: {},
        })

        expect(got.supportedFeatures).toStrictEqual({runsOffline: true})
      })
    })

    test('returns runsOffline false when runs_offline is disabled', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const uiExtension = await testUIExtension({
          directory: tmpDir,
          configuration: {
            name: 'test-extension',
            type: 'ui_extension',
            metafields: [],
            capabilities: {},
            supported_features: {runs_offline: false},
            extension_points: [],
          },
        })

        const got = await getUIExtensionPayload(uiExtension, 'mock-bundle-path', {
          ...({} as ExtensionsPayloadStoreOptions),
          currentDevelopmentPayload: {},
        })

        expect(got.supportedFeatures).toStrictEqual({runsOffline: false})
      })
    })

    test('returns runsOffline false when supported_features is not configured', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const uiExtension = await testUIExtension({
          directory: tmpDir,
          configuration: {
            name: 'test-extension',
            type: 'ui_extension',
            metafields: [],
            capabilities: {},
            extension_points: [],
          },
        })

        const got = await getUIExtensionPayload(uiExtension, 'mock-bundle-path', {
          ...({} as ExtensionsPayloadStoreOptions),
          currentDevelopmentPayload: {},
        })

        expect(got.supportedFeatures).toStrictEqual({runsOffline: false})
      })
    })
  })

  test('adds root.url, resource.url and surface to extensionPoints[n] when extensionPoints[n] is an object', async () => {
    await inTemporaryDirectory(async (_tmpDir) => {
      const uiExtension = await testUIExtension({
        devUUID: 'devUUID',
        configuration: {
          name: 'UI Extension',
          type: 'ui_extension',
          metafields: [],
          capabilities: {
            network_access: false,
            block_progress: false,
            api_access: false,
            collect_buyer_consent: {sms_marketing: false, customer_privacy: false},
            iframe: {sources: []},
          },
          extension_points: [
            {target: 'Admin::Checkout::Editor::Settings', module: './src/AdminCheckoutEditorSettings.js'},
            {target: 'admin.checkout.editor.settings', module: './src/AdminCheckoutEditorSettings.js'},
            {target: 'Checkout::ShippingMethods::RenderAfter', module: './src/CheckoutShippingMethodsRenderAfter.js'},
          ],
        },
      })

      const got = await getUIExtensionPayload(uiExtension, 'mock-bundle-path', {
        ...({} as ExtensionsPayloadStoreOptions),
        currentDevelopmentPayload: {},
        url: 'http://tunnel-url.com',
      })

      expect(got.extensionPoints).toStrictEqual([
        {
          target: 'Admin::Checkout::Editor::Settings',
          module: './src/AdminCheckoutEditorSettings.js',
          surface: 'admin',
          root: {url: 'http://tunnel-url.com/extensions/devUUID/Admin::Checkout::Editor::Settings'},
          resource: {url: ''},
        },
        {
          target: 'admin.checkout.editor.settings',
          module: './src/AdminCheckoutEditorSettings.js',
          surface: 'admin',
          root: {url: 'http://tunnel-url.com/extensions/devUUID/admin.checkout.editor.settings'},
          resource: {url: ''},
        },
        {
          target: 'Checkout::ShippingMethods::RenderAfter',
          module: './src/CheckoutShippingMethodsRenderAfter.js',
          surface: 'checkout',
          root: {url: 'http://tunnel-url.com/extensions/devUUID/Checkout::ShippingMethods::RenderAfter'},
          resource: {url: ''},
        },
      ])
    })
  })

  test('adds apiVersion when present in the configuration', async () => {
    await inTemporaryDirectory(async () => {
      const uiExtension = await testUIExtension({
        devUUID: 'devUUID',
        configuration: {
          name: 'UI Extension',
          type: 'ui_extension',
          api_version: '2023-01',
          metafields: [],
          capabilities: {
            network_access: false,
            block_progress: false,
            api_access: false,
            collect_buyer_consent: {sms_marketing: false, customer_privacy: false},
            iframe: {sources: []},
          },
          extension_points: [
            {target: 'Admin::Checkout::Editor::Settings', module: './src/AdminCheckoutEditorSettings.js'},
          ],
        },
      })

      const got = await getUIExtensionPayload(uiExtension, 'mock-bundle-path', {
        ...({} as ExtensionsPayloadStoreOptions),
        currentDevelopmentPayload: {},
        url: 'http://tunnel-url.com',
      })

      expect(got).toHaveProperty('apiVersion', '2023-01')
    })
  })
})
