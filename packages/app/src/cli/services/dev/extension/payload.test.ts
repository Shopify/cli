import {UIExtensionPayload} from './payload/models.js'
import {getUIExtensionPayload} from './payload.js'
import {ExtensionDevOptions} from '../extension.js'
import {testApp, testUIExtension} from '../../../models/app/app.test-data.js'
import {getUIExtensionRendererVersion} from '../../../models/app/app.js'
import {describe, expect, test, vi} from 'vitest'
import {file, path} from '@shopify/cli-kit'

vi.mock('../../../models/app/app.js')

describe('getUIExtensionPayload', () => {
  test('returns the right payload', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const outputBundlePath = path.join(tmpDir, 'main.js')
      await file.touch(outputBundlePath)
      const signal: any = vi.fn()
      const stdout: any = vi.fn()
      const stderr: any = vi.fn()
      vi.mocked(getUIExtensionRendererVersion).mockResolvedValue({
        name: 'extension-renderer',
        version: '1.2.3',
      })

      const uiExtension = await testUIExtension({
        outputBundlePath,
        directory: tmpDir,
        configuration: {
          name: 'test-ui-extension',
          type: 'checkout_ui_extension',
          metafields: [],
          capabilities: {
            block_progress: false,
            network_access: true,
            api_access: true,
          },
          extensionPoints: ['CUSTOM_EXTENSION_POINT'],
        },
        devUUID: 'devUUID',
      })

      const options: ExtensionDevOptions = {
        signal,
        stdout,
        stderr,
        apiKey: 'api-key',
        app: testApp(),
        extensions: [uiExtension],
        grantedScopes: ['scope-a'],
        port: 123,
        url: 'http://tunnel-url.com',
        storeFqdn: 'my-domain.com',
        buildDirectory: tmpDir,
        checkoutCartUrl: 'https://my-domain.com/cart',
        subscriptionProductUrl: 'https://my-domain.com/subscription',
      }
      const development: Partial<UIExtensionPayload['development']> = {
        hidden: true,
        status: 'success',
      }

      // When
      const got = await getUIExtensionPayload(uiExtension, {
        ...options,
        currentDevelopmentPayload: development,
      })

      // Then
      expect(got).toMatchObject({
        assets: {
          main: {
            lastUpdated: expect.any(Number),
            name: 'main',
            url: 'http://tunnel-url.com/extensions/devUUID/assets/main.js',
          },
        },
        capabilities: {
          blockProgress: false,
          networkAccess: true,
          apiAccess: true,
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
        categories: null,
        extensionPoints: ['CUSTOM_EXTENSION_POINT'],
        externalType: 'checkout_ui',
        localization: null,
        metafields: null,
        surface: 'checkout',
        title: 'test-ui-extension',
        type: 'checkout_ui_extension',
        uuid: 'devUUID',
        version: '1.2.3',
        approvalScopes: ['scope-a'],
      })
    })
  })

  test('default values', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uiExtension = await testUIExtension({directory: tmpDir})
      const options: ExtensionDevOptions = {} as ExtensionDevOptions
      const development: Partial<UIExtensionPayload['development']> = {}

      // When
      const got = await getUIExtensionPayload(uiExtension, {
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
        },
      })
    })
  })

  test('adds root.url and surface to extensionPoints[n] when extensionPoints[n] is an object', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const uiExtension = await testUIExtension({
        devUUID: 'devUUID',
        configuration: {
          name: 'UI Extension',
          type: 'ui_extension',
          metafields: [],
          capabilities: {
            block_progress: false,
            network_access: false,
            api_access: false,
          },
          extensionPoints: [
            {
              target: 'Admin::Checkout::Editor::Settings',
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
      const got = await getUIExtensionPayload(uiExtension, {
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
        },
        {
          target: 'Checkout::ShippingMethods::RenderAfter',
          module: './src/CheckoutShippingMethodsRenderAfter.js',
          surface: 'checkout',
          root: {
            url: 'http://tunnel-url.com/extensions/devUUID/Checkout::ShippingMethods::RenderAfter',
          },
        },
      ])
    })
  })
})
