import {UIExtensionPayload} from './payload/models.js'
import {getUIExtensionPayload} from './payload.js'
import {ExtensionDevOptions} from '../extension.js'
import {testUIExtension} from '../../../models/app/app.test-data.js'
import * as appModel from '../../../models/app/app.js'
import {describe, expect, test, vi} from 'vitest'
import {inTemporaryDirectory, touchFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

describe('getUIExtensionPayload', () => {
  test('returns the right payload', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const outputPath = joinPath(tmpDir, 'test-ui-extension.js')
      await touchFile(outputPath)
      const signal: any = vi.fn()
      const stdout: any = vi.fn()
      const stderr: any = vi.fn()
      vi.spyOn(appModel, 'getUIExtensionRendererVersion').mockResolvedValue({
        name: 'extension-renderer',
        version: '1.2.3',
      })

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

      const options: Omit<ExtensionDevOptions, 'appWatcher'> = {
        signal,
        stdout,
        stderr,
        apiKey: 'api-key',
        appName: 'foobar',
        appDirectory: '/tmp',
        extensions: [uiExtension],
        grantedScopes: ['scope-a'],
        port: 123,
        url: 'http://tunnel-url.com',
        storeFqdn: 'my-domain.com',
        storeId: '123456789',
        buildDirectory: tmpDir,
        checkoutCartUrl: 'https://my-domain.com/cart',
        subscriptionProductUrl: 'https://my-domain.com/subscription',
        manifestVersion: '3',
      }
      const development: Partial<UIExtensionPayload['development']> = {
        hidden: true,
        status: 'success',
      }

      // When
      const got = await getUIExtensionPayload(uiExtension, 'mock-bundle-path', {
        ...options,
        currentDevelopmentPayload: development,
      })

      // Then
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
          resource: {
            url: 'https://my-domain.com/cart',
          },
          root: {
            url: 'http://tunnel-url.com/extensions/devUUID',
          },
          status: 'success',
        },
        extensionPoints: ['CUSTOM_EXTENSION_POINT'],
        externalType: 'checkout_ui_extension_external',
        localization: null,
        metafields: null,
        // as surfaces come from remote specs, we dont' have real values here
        surface: 'test-surface',
        title: 'test-ui-extension',
        type: 'checkout_ui_extension',
        uuid: 'devUUID',
        version: '1.2.3',
        approvalScopes: ['scope-a'],
      })
    })
  })

  test('returns the right payload for UI Extensions with build_manifest', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const outputPath = joinPath(tmpDir, 'test-ui-extension.js')
      await touchFile(outputPath)
      const signal: any = vi.fn()
      const stdout: any = vi.fn()
      const stderr: any = vi.fn()
      vi.spyOn(appModel, 'getUIExtensionRendererVersion').mockResolvedValue({
        name: 'extension-renderer',
        version: '1.2.3',
      })

      const buildManifest = {
        assets: {
          main: {identifier: 'main', module: './src/ExtensionPointA.js', filepath: '/test-ui-extension.js'},
          should_render: {
            identifier: 'should_render',
            module: './src/ShouldRender.js',
            filepath: '/test-ui-extension-conditions.js',
          },
        },
      }

      const uiExtension = await testUIExtension({
        outputPath,
        directory: tmpDir,
        configuration: {
          name: 'test-ui-extension',
          type: 'ui_extension',
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
          extension_points: [
            {
              target: 'CUSTOM_EXTENSION_POINT',
              build_manifest: buildManifest,
            },
          ],
        },
        devUUID: 'devUUID',
      })

      const options: Omit<ExtensionDevOptions, 'appWatcher'> = {
        signal,
        stdout,
        stderr,
        apiKey: 'api-key',
        appName: 'foobar',
        appDirectory: '/tmp',
        extensions: [uiExtension],
        grantedScopes: ['scope-a'],
        port: 123,
        url: 'http://tunnel-url.com',
        storeFqdn: 'my-domain.com',
        storeId: '123456789',
        buildDirectory: tmpDir,
        checkoutCartUrl: 'https://my-domain.com/cart',
        subscriptionProductUrl: 'https://my-domain.com/subscription',
        manifestVersion: '3',
      }
      const development: Partial<UIExtensionPayload['development']> = {
        hidden: true,
        status: 'success',
      }

      // When
      const got = await getUIExtensionPayload(uiExtension, 'mock-bundle-path', {
        ...options,
        currentDevelopmentPayload: development,
      })

      // Then
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
          resource: {
            url: '',
          },
          root: {
            url: 'http://tunnel-url.com/extensions/devUUID',
          },
          status: 'success',
        },
        extensionPoints: [
          {
            target: 'CUSTOM_EXTENSION_POINT',
            build_manifest: buildManifest,
            assets: {
              main: {
                lastUpdated: expect.any(Number),
                name: 'main',
                url: 'http://tunnel-url.com/extensions/devUUID/assets/test-ui-extension.js',
              },
              should_render: {
                lastUpdated: expect.any(Number),
                name: 'should_render',
                url: 'http://tunnel-url.com/extensions/devUUID/assets/test-ui-extension-conditions.js',
              },
            },
          },
        ],
        externalType: 'ui_extension_external',
        localization: null,
        metafields: null,
        // as surfaces come from remote specs, we dont' have real values here
        surface: 'test-surface',
        title: 'test-ui-extension',
        type: 'ui_extension',
        uuid: 'devUUID',
        version: '1.2.3',
        approvalScopes: ['scope-a'],
      })
    })
  })

  test('returns the right payload for post-purchase extensions', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const outputPath = joinPath(tmpDir, 'test-post-purchase-extension.js')
      await touchFile(outputPath)
      const signal: any = vi.fn()
      const stdout: any = vi.fn()
      const stderr: any = vi.fn()
      vi.spyOn(appModel, 'getUIExtensionRendererVersion').mockResolvedValue({
        name: 'extension-renderer',
        version: '1.2.3',
      })

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
          extension_points: [
            {
              target: 'CUSTOM_EXTENSION_POINT',
            },
          ],
        },
        devUUID: 'devUUID',
      })

      const options: Omit<ExtensionDevOptions, 'appWatcher'> = {
        signal,
        stdout,
        stderr,
        apiKey: 'api-key',
        appName: 'foobar',
        appDirectory: '/tmp',
        extensions: [postPurchaseExtension],
        grantedScopes: ['scope-a'],
        port: 123,
        url: 'http://tunnel-url.com',
        storeFqdn: 'my-domain.com',
        storeId: '123456789',
        buildDirectory: tmpDir,
        checkoutCartUrl: 'https://my-domain.com/cart',
        subscriptionProductUrl: 'https://my-domain.com/subscription',
        manifestVersion: '3',
      }
      const development: Partial<UIExtensionPayload['development']> = {
        hidden: true,
        status: 'success',
      }

      // When
      const got = await getUIExtensionPayload(postPurchaseExtension, 'mock-bundle-path', {
        ...options,
        currentDevelopmentPayload: development,
      })

      // Then
      expect(got).toMatchObject({
        assets: {
          main: {
            lastUpdated: expect.any(Number),
            name: 'main',
            url: 'http://tunnel-url.com/extensions/devUUID/assets/test-post-purchase-extension.js',
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
          resource: {
            url: 'https://my-domain.com/cart',
          },
          root: {
            url: 'http://tunnel-url.com/extensions/devUUID/purchase.post.render',
          },
          status: 'success',
        },
        extensionPoints: [
          {
            target: 'purchase.post.render',
          },
        ],
        externalType: 'checkout_post_purchase_external',
        localization: null,
        metafields: null,
        // as surfaces come from remote specs, we dont' have real values here
        surface: 'test-surface',
        title: 'test-post-purchase-extension',
        type: 'checkout_post_purchase',
        uuid: 'devUUID',
        version: '1.2.3',
        approvalScopes: ['scope-a'],
      })
    })
  })

  test('default values', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uiExtension = await testUIExtension({directory: tmpDir})
      const options: ExtensionDevOptions = {} as ExtensionDevOptions
      const development: Partial<UIExtensionPayload['development']> = {}

      // When
      const got = await getUIExtensionPayload(uiExtension, 'mock-bundle-path', {
        ...options,
        currentDevelopmentPayload: development,
      })

      // Then
      expect(got).toMatchObject({
        development: {
          hidden: false,
        },
        capabilities: {
          blockProgress: false,
          networkAccess: false,
          apiAccess: false,
          collectBuyerConsent: {
            smsMarketing: false,
          },
          iframe: {
            sources: [],
          },
        },
      })
    })
  })

  test('adds root.url, resource.url and surface to extensionPoints[n] when extensionPoints[n] is an object', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
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
            collect_buyer_consent: {
              sms_marketing: false,
              customer_privacy: false,
            },
            iframe: {
              sources: [],
            },
          },
          extension_points: [
            {
              target: 'Admin::Checkout::Editor::Settings',
              module: './src/AdminCheckoutEditorSettings.js',
            },
            {
              target: 'admin.checkout.editor.settings',
              module: './src/AdminCheckoutEditorSettings.js',
            },
            {
              target: 'Checkout::ShippingMethods::RenderAfter',
              module: './src/CheckoutShippingMethodsRenderAfter.js',
            },
          ],
        },
      })

      const options: ExtensionDevOptions = {} as ExtensionDevOptions
      const development: Partial<UIExtensionPayload['development']> = {}

      // When
      const got = await getUIExtensionPayload(uiExtension, 'mock-bundle-path', {
        ...options,
        currentDevelopmentPayload: development,
        url: 'http://tunnel-url.com',
      })

      // Then
      expect(got.extensionPoints).toStrictEqual([
        {
          target: 'Admin::Checkout::Editor::Settings',
          module: './src/AdminCheckoutEditorSettings.js',
          surface: 'admin',
          root: {
            url: 'http://tunnel-url.com/extensions/devUUID/Admin::Checkout::Editor::Settings',
          },
          resource: {
            url: '',
          },
        },
        {
          target: 'admin.checkout.editor.settings',
          module: './src/AdminCheckoutEditorSettings.js',
          surface: 'admin',
          root: {
            url: 'http://tunnel-url.com/extensions/devUUID/admin.checkout.editor.settings',
          },
          resource: {
            url: '',
          },
        },
        {
          target: 'Checkout::ShippingMethods::RenderAfter',
          module: './src/CheckoutShippingMethodsRenderAfter.js',
          surface: 'checkout',
          root: {
            url: 'http://tunnel-url.com/extensions/devUUID/Checkout::ShippingMethods::RenderAfter',
          },
          resource: {
            url: '',
          },
        },
      ])
    })
  })

  test('adds apiVersion when present in the configuration', async () => {
    await inTemporaryDirectory(async () => {
      // Given
      const apiVersion = '2023-01'
      const uiExtension = await testUIExtension({
        devUUID: 'devUUID',
        configuration: {
          name: 'UI Extension',
          type: 'ui_extension',
          api_version: apiVersion,
          metafields: [],
          capabilities: {
            network_access: false,
            block_progress: false,
            api_access: false,
            collect_buyer_consent: {
              sms_marketing: false,
              customer_privacy: false,
            },
            iframe: {
              sources: [],
            },
          },
          extension_points: [
            {
              target: 'Admin::Checkout::Editor::Settings',
              module: './src/AdminCheckoutEditorSettings.js',
            },
          ],
        },
      })

      const options: ExtensionDevOptions = {} as ExtensionDevOptions
      const development: Partial<UIExtensionPayload['development']> = {}

      // When
      const got = await getUIExtensionPayload(uiExtension, 'mock-bundle-path', {
        ...options,
        currentDevelopmentPayload: development,
        url: 'http://tunnel-url.com',
      })

      // Then
      expect(got).toHaveProperty('apiVersion', apiVersion)
    })
  })
})
