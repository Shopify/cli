import {
  AppSchema,
  CurrentAppConfiguration,
  LegacyAppConfiguration,
  getAppScopes,
  getAppScopesArray,
  getUIExtensionRendererVersion,
  isCurrentAppSchema,
  isLegacyAppSchema,
  validateExtensionsHandlesInCollection,
  validateFunctionExtensionsWithUiHandle,
} from './app.js'
import {
  DEFAULT_CONFIG,
  testApp,
  testUIExtension,
  testFunctionExtension,
  testWebhookExtensions,
  testEditorExtensionCollection,
  testAppAccessConfigExtension,
  testAppHomeConfigExtension,
  testAppProxyConfigExtension,
} from './app.test-data.js'
import {ExtensionInstance} from '../extensions/extension-instance.js'
import {FunctionConfigType} from '../extensions/specifications/function.js'
import {WebhooksConfig} from '../extensions/specifications/types/app_config_webhook.js'
import {EditorExtensionCollectionType} from '../extensions/specifications/editor_extension_collection.js'
import {ApplicationURLs} from '../../services/dev/urls.js'
import {describe, expect, test, vi} from 'vitest'
import {inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'

const CORRECT_CURRENT_APP_SCHEMA: CurrentAppConfiguration = {
  path: '',
  name: 'app 1',
  client_id: '12345',
  extension_directories: ['extensions/*'],
  webhooks: {
    api_version: '2023-04',
    privacy_compliance: {
      customer_deletion_url: 'https://google.com',
      customer_data_request_url: 'https://google.com',
      shop_deletion_url: 'https://google.com',
    },
  },
  application_url: 'http://example.com',
  embedded: false,
  auth: {
    redirect_urls: ['https://google.com'],
  },
  app_proxy: {
    url: 'https://google.com',
    subpath: 'https://google.com',
    prefix: 'https://google.com',
  },
  build: {
    automatically_update_urls_on_dev: true,
    dev_store_url: 'https://google.com',
    include_config_on_deploy: true,
  },
}

const CORRECT_LEGACY_APP_SCHEMA: LegacyAppConfiguration = {
  path: '',
  extension_directories: [],
  web_directories: [],
  scopes: 'write_products',
}

describe('app schema validation', () => {
  describe('legacy schema validator', () => {
    test('checks whether legacy app schema is valid -- pass', () => {
      expect(isLegacyAppSchema(CORRECT_LEGACY_APP_SCHEMA)).toBe(true)
    })
    test('checks whether legacy app schema is valid -- fail', () => {
      const config = {
        ...CORRECT_LEGACY_APP_SCHEMA,
        some_other_key: 'i am not valid, i will fail',
      }
      expect(isLegacyAppSchema(config)).toBe(false)
    })
  })

  describe('current schema validator', () => {
    test('checks whether current app schema is valid -- pass', () => {
      expect(isCurrentAppSchema(CORRECT_CURRENT_APP_SCHEMA)).toBe(true)
    })
    test('checks whether current app schema is valid -- fail', () => {
      const config = {
        ...CORRECT_CURRENT_APP_SCHEMA,
      }

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      delete config.client_id

      expect(isCurrentAppSchema(config)).toBe(false)
    })

    test('extension_directories should be transformed to double asterisks', () => {
      const config = {
        ...CORRECT_CURRENT_APP_SCHEMA,
        extension_directories: ['extensions/*'],
      }
      const parsed = AppSchema.parse(config)
      expect(parsed.extension_directories).toEqual(['extensions/**'])
    })

    test('extension_directories is not transformed if it ends with double asterisks', () => {
      const config = {
        ...CORRECT_CURRENT_APP_SCHEMA,
        extension_directories: ['extensions/**'],
      }
      const parsed = AppSchema.parse(config)
      expect(parsed.extension_directories).toEqual(['extensions/**'])
    })

    test('extension_directories is not transformed if it doesnt end with a wildcard', () => {
      const config = {
        ...CORRECT_CURRENT_APP_SCHEMA,
        extension_directories: ['extensions'],
      }
      const parsed = AppSchema.parse(config)
      expect(parsed.extension_directories).toEqual(['extensions'])
    })
  })
})

describe('getUIExtensionRendererVersion', () => {
  test('returns the version of the dependency package for product_subscription', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await createPackageJson(tmpDir, 'admin-ui-extensions', '2.4.5')
      const extension = await testUIExtension({type: 'product_subscription', directory: tmpDir})

      // When
      const got = await getUIExtensionRendererVersion(extension)

      // Then
      expect(got).not.toEqual('not_found')
      if (got === 'not_found') return
      expect(got?.name).to.toEqual('@shopify/admin-ui-extensions')
      expect(got?.version).toEqual('2.4.5')
    })
  })

  test('returns the version of the dependency package for checkout_ui_extension', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await createPackageJson(tmpDir, 'checkout-ui-extensions', '1.4.5')
      const extension = await testUIExtension({type: 'checkout_ui_extension', directory: tmpDir})

      // When
      const got = await getUIExtensionRendererVersion(extension)

      // Then
      expect(got).not.toEqual('not_found')
      if (got === 'not_found') return
      expect(got?.name).to.toEqual('@shopify/checkout-ui-extensions')
      expect(got?.version).toEqual('1.4.5')
    })
  })

  test('returns the version of the dependency package for checkout_post_purchase', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await createPackageJson(tmpDir, 'post-purchase-ui-extensions', '3.4.5')
      const extension = await testUIExtension({type: 'checkout_post_purchase', directory: tmpDir})

      // When
      const got = await getUIExtensionRendererVersion(extension)

      // Then
      expect(got).not.toEqual('not_found')
      if (got === 'not_found') return
      expect(got?.name).to.toEqual('@shopify/post-purchase-ui-extensions')
      expect(got?.version).toEqual('3.4.5')
    })
  })

  test('returns the version of the dependency package for web_pixel', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await createPackageJson(tmpDir, 'web-pixels-extension', '3.4.5')
      const extension = await testUIExtension({type: 'web_pixel_extension', directory: tmpDir})

      // When
      const got = await getUIExtensionRendererVersion(extension)

      // Then
      expect(got).not.toEqual('not_found')
      if (got === 'not_found') return
      expect(got?.name).to.toEqual('@shopify/web-pixels-extension')
      expect(got?.version).toEqual('3.4.5')
    })
  })

  test('returns not_found if there is no renderer package', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const extension = await testUIExtension({type: 'product_subscription'})

      // When
      const got = await getUIExtensionRendererVersion(extension)

      // Then
      expect(got).toEqual('not_found')
    })
  })
})

describe('getAppScopes', () => {
  test('returns the scopes key when schema is legacy', () => {
    const config = {path: '', scopes: 'read_themes,read_products'}
    expect(getAppScopes(config)).toEqual('read_themes,read_products')
  })

  test('returns the access_scopes.scopes key when schema is current', () => {
    const config = {...DEFAULT_CONFIG, access_scopes: {scopes: 'read_themes,read_themes'}}
    expect(getAppScopes(config)).toEqual('read_themes,read_themes')
  })
})

describe('getAppScopesArray', () => {
  test('returns the scopes key when schema is legacy', () => {
    const config = {path: '', scopes: 'read_themes, read_order ,write_products'}
    expect(getAppScopesArray(config)).toEqual(['read_themes', 'read_order', 'write_products'])
  })

  test('returns the access_scopes.scopes key when schema is current', () => {
    const config = {...DEFAULT_CONFIG, access_scopes: {scopes: 'read_themes, read_order ,write_products'}}
    expect(getAppScopesArray(config)).toEqual(['read_themes', 'read_order', 'write_products'])
  })
})

describe('preDeployValidation', () => {
  test('throws an error when app-specific webhooks are used with legacy install flow', async () => {
    // Given
    const configuration: CurrentAppConfiguration = {
      ...DEFAULT_CONFIG,
      access_scopes: {
        scopes: 'read_orders',
        use_legacy_install_flow: true,
      },
      webhooks: {
        api_version: '2024-07',
        subscriptions: [
          {
            topics: ['orders/create'],
            uri: 'webhooks',
          },
        ],
      },
    }
    const app = testApp({configuration})

    // When/Then
    await expect(app.preDeployValidation()).rejects.toThrow(
      new AbortError(
        'App-specific webhook subscriptions are not supported when use_legacy_install_flow is enabled.',
        `To use app-specific webhooks, you need to:
1. Remove 'use_legacy_install_flow = true' from your configuration
2. Run 'shopify app deploy' to sync your scopes with the Partner Dashboard

Alternatively, continue using shop-specific webhooks with the legacy install flow.

Learn more: https://shopify.dev/docs/apps/build/authentication-authorization/app-installation`,
      ),
    )
  })

  test('does not throw an error when app-specific webhooks are used without legacy install flow', async () => {
    // Given
    const configuration: CurrentAppConfiguration = {
      ...DEFAULT_CONFIG,
      access_scopes: {
        scopes: 'read_orders',
        use_legacy_install_flow: false,
      },
      webhooks: {
        api_version: '2024-07',
        subscriptions: [
          {
            topics: ['orders/create'],
            uri: 'webhooks',
          },
        ],
      },
    }
    const app = testApp({configuration})

    // When/Then
    await expect(app.preDeployValidation()).resolves.not.toThrow()
  })

  test('does not throw an error when legacy install flow is enabled without app-specific webhooks', async () => {
    // Given
    const configuration: CurrentAppConfiguration = {
      ...DEFAULT_CONFIG,
      access_scopes: {
        scopes: 'read_orders',
        use_legacy_install_flow: true,
      },
      webhooks: {
        api_version: '2024-07',
      },
    }
    const app = testApp({configuration})

    // When/Then
    await expect(app.preDeployValidation()).resolves.not.toThrow()
  })

  test('does not throw an error when neither app-specific webhooks nor legacy install flow are used', async () => {
    // Given
    const configuration: CurrentAppConfiguration = {
      ...DEFAULT_CONFIG,
      access_scopes: {
        scopes: 'read_orders',
      },
      webhooks: {
        api_version: '2024-07',
      },
    }
    const app = testApp({configuration})

    // When/Then
    await expect(app.preDeployValidation()).resolves.not.toThrow()
  })

  test('does not throw an error for legacy schema apps', async () => {
    // Given
    const configuration: LegacyAppConfiguration = {
      ...CORRECT_LEGACY_APP_SCHEMA,
      scopes: 'read_orders',
    }
    const app = testApp(configuration, 'legacy')

    // When/Then
    await expect(app.preDeployValidation()).resolves.not.toThrow()
  })

  test('handles null/undefined subscriptions safely', async () => {
    // Given
    const configuration: CurrentAppConfiguration = {
      ...DEFAULT_CONFIG,
      access_scopes: {
        scopes: 'read_orders',
        use_legacy_install_flow: true,
      },
      webhooks: {
        api_version: '2024-07',
        // Testing edge case
        subscriptions: null as any,
      },
    }
    const app = testApp({configuration})

    // When/Then
    await expect(app.preDeployValidation()).resolves.not.toThrow()
  })
})

describe('validateFunctionExtensionsWithUiHandle', () => {
  const generateFunctionConfig = ({type, uiHandle}: {type?: string; uiHandle?: string}): FunctionConfigType => ({
    description: 'description',
    build: {
      command: 'echo "hello world"',
      wasm_opt: true,
    },
    api_version: '2022-07',
    configuration_ui: true,
    name: 'test function extension',
    type: type ?? 'product_discounts',
    ui: {
      handle: uiHandle ?? 'test-ui-handle',
    },
  })

  describe('returns errors when app configuration is invalid', () => {
    test("when a function's ui handle does not match any local ui extension", async () => {
      // Given
      const validFunctionWithUiExtension = await testFunctionExtension({
        config: generateFunctionConfig({uiHandle: 'test-ui-extension'}),
      })
      const allExtensions: ExtensionInstance[] = [validFunctionWithUiExtension]
      const app = await testApp({
        allExtensions,
      })

      // When
      const expectedErrors = [
        "[test function extension] - Local app must contain a ui_extension with handle 'test-ui-extension'",
      ]
      const result = validateFunctionExtensionsWithUiHandle([validFunctionWithUiExtension], app.allExtensions)

      // Then
      expect(result).toStrictEqual(expectedErrors)
    })

    test('returns error when a functions matching extension, and not of type ui extension', async () => {
      // Given
      const functionWithUiHandle = await testFunctionExtension({
        config: {
          ...generateFunctionConfig({type: 'product_discounts', uiHandle: 'product_discounts-test'}),
          handle: 'product_discounts',
        },
      })
      const functionWithMatchingHandle = await testFunctionExtension({
        config: {
          ...generateFunctionConfig({type: 'product_discounts'}),
          handle: 'product-discounts-test',
        },
      })

      const allExtensions: ExtensionInstance[] = [functionWithUiHandle, functionWithMatchingHandle]
      const app = await testApp({
        allExtensions,
      })

      // When
      const expectedErrors = [
        "[test function extension] - Local app must contain a ui_extension with handle 'product_discounts-test'",
      ]
      const result = validateFunctionExtensionsWithUiHandle([functionWithUiHandle], app.allExtensions)

      // Then
      expect(result).toStrictEqual(expectedErrors)
    })

    test('returns errors for editor extension collection', async () => {
      // Given
      const configuration = {
        name: 'Order summary',
        handle: 'order-summary-collection',
        includes: ['handle1', 'product-discounts-test', 'admin-extension', 'customer-account-extension'],
      }
      const editorExtensionCollection = (await testEditorExtensionCollection({
        configuration,
      })) as ExtensionInstance<EditorExtensionCollectionType>

      const orderDiscountFunction = await testFunctionExtension({
        config: {
          ...generateFunctionConfig({type: 'product_discounts'}),
          handle: 'product-discounts-test',
        },
      })

      const adminUiExtension = await testUIExtension({
        type: 'ui_extension',
        configuration: {
          type: 'ui_extension',
          handle: 'admin-extension',
          extension_points: [
            {
              target: 'admin.customers.segmentation-templates.render',
              module: './src/ExtensionPointA.js',
            },
          ],
        },
      })

      const customerAccountUiExtension = await testUIExtension({
        type: 'ui_extension',
        configuration: {
          type: 'ui_extension',
          handle: 'customer-account-extension',
          extension_points: [
            {
              target: 'customer-account.order-index.block.render',
              module: './src/ExtensionPointB.js',
            },
          ],
        },
      })

      const allExtensions: ExtensionInstance[] = [
        editorExtensionCollection,
        orderDiscountFunction,
        adminUiExtension,
        customerAccountUiExtension,
      ]

      const app = await testApp({
        allExtensions,
      })

      // When
      const expectedErrors = [
        "[order-summary-collection] editor extension collection: Add extension with handle 'handle1' to local app. Local app must include extension with handle 'handle1'.",
        "[order-summary-collection] editor extension collection: Remove extension of type 'function' from this collection. This extension type is not supported in collections.",
        "[order-summary-collection] editor extension collection: Remove extension 'admin-extension' with target 'admin.customers.segmentation-templates.render' from this collection. This extension target is not supported in collections.",
      ]
      const result = validateExtensionsHandlesInCollection([editorExtensionCollection], app.allExtensions)

      // Then
      expect(result).toStrictEqual(expectedErrors)
    })

    test('returns undefined when validation passes', async () => {
      // Given
      const validUiExtension = await testUIExtension({type: 'ui_extension'})
      const validFunctionWithUiExtension = await testFunctionExtension({
        config: generateFunctionConfig({uiHandle: 'test-ui-extension'}),
      })
      const allExtensions: ExtensionInstance[] = [validUiExtension, validFunctionWithUiExtension]
      const app = await testApp({
        allExtensions,
      })

      // When
      const result = validateFunctionExtensionsWithUiHandle([validFunctionWithUiExtension], app.allExtensions)

      // Then
      expect(result).toBeUndefined()
    })
  })
})

describe('allExtensions', () => {
  interface WebhookTestConfig {
    webhooks: WebhooksConfig
  }

  test('keeps declarative webhook config when flag is enabled', async () => {
    const webhookExtensions = await testWebhookExtensions({complianceTopics: true})
    const app = testApp(
      {
        configuration: CORRECT_CURRENT_APP_SCHEMA,
        allExtensions: webhookExtensions,
        remoteFlags: [],
      },
      'current',
    )

    const webhookConfig = app.allExtensions.find((ext) => ext.handle === 'webhooks')!
      .configuration as unknown as WebhookTestConfig
    const privacyConfig = app.allExtensions.find((ext) => ext.handle === 'privacy_compliance_webhooks')!
      .configuration as unknown as WebhookTestConfig

    expect(webhookConfig.webhooks.subscriptions!.length).not.toStrictEqual(0)
    expect(webhookConfig.webhooks.privacy_compliance).toBeDefined()
    expect(privacyConfig.webhooks.subscriptions!.length).not.toStrictEqual(0)
    expect(privacyConfig.webhooks.privacy_compliance).toBeDefined()
  })

  test('includes configuration extensions when include_config_on_deploy is enabled', async () => {
    const configExtension = await testAppAccessConfigExtension()
    const app = testApp(
      {
        configuration: CORRECT_CURRENT_APP_SCHEMA,
        allExtensions: [configExtension],
      },
      'current',
    )

    expect(app.allExtensions).toContain(configExtension)
  })

  test('does not include configuration extensions when include_config_on_deploy is disabled', async () => {
    const configuration = {
      ...CORRECT_CURRENT_APP_SCHEMA,
      build: {
        automatically_update_urls_on_dev: true,
        dev_store_url: 'https://google.com',
        include_config_on_deploy: false,
      },
    }
    const configExtension = await testAppAccessConfigExtension()
    const app = testApp(
      {
        configuration,
        allExtensions: [configExtension],
      },
      'current',
    )

    expect(app.allExtensions).toHaveLength(0)
  })

  test('includes configuration extensions when using App Management API, ignoring include_config_on_deploy', async () => {
    const configuration = {
      ...CORRECT_CURRENT_APP_SCHEMA,
      organization_id: '12345',
      build: {
        automatically_update_urls_on_dev: true,
        dev_store_url: 'https://google.com',
        include_config_on_deploy: false,
      },
    }
    const configExtension = await testAppAccessConfigExtension()
    const app = testApp(
      {
        configuration,
        allExtensions: [configExtension],
      },
      'current',
    )

    expect(app.allExtensions).toContain(configExtension)
  })
})

describe('manifest', () => {
  test('generates a manifest with basic app information and modules', async () => {
    // Given
    const appAccessModule = await testAppAccessConfigExtension()

    const app = await testApp({
      name: 'my-app',
      allExtensions: [appAccessModule],
      configuration: {
        ...DEFAULT_CONFIG,
        client_id: 'test-client-id',
      },
    })

    // When
    const manifest = await app.manifest({
      app: 'API_KEY',
      extensions: {app_access: 'UUID_A'},
      extensionIds: {},
      extensionsNonUuidManaged: {},
    })

    // Then
    expect(manifest).toEqual({
      name: 'my-app',
      handle: '',
      modules: [
        {
          type: 'app_access_external',
          handle: 'app_access',
          uid: appAccessModule.uid,
          uuid: 'UUID_A',
          assets: appAccessModule.uid,
          target: appAccessModule.contextValue,
          config: expect.objectContaining({
            redirect_url_allowlist: ['https://example.com/auth/callback'],
          }),
        },
      ],
    })
  })

  test('patches the manifest with development URLs when available', async () => {
    // Given
    const appHome = await testAppHomeConfigExtension()
    const appAccess = await testAppAccessConfigExtension()
    const appProxy = await testAppProxyConfigExtension()

    const devApplicationURLs: ApplicationURLs = {
      applicationUrl: 'https://new-url.io',
      redirectUrlWhitelist: ['https://new-url.io/auth/callback'],
      appProxy: {
        proxyUrl: 'https://new-proxy-url.io',
        proxySubPath: '/updated-path',
        proxySubPathPrefix: 'updated-prefix',
      },
    }

    const app = await testApp({
      name: 'my-app',
      allExtensions: [appHome, appProxy, appAccess],
      configuration: {
        ...DEFAULT_CONFIG,
        client_id: 'test-client-id',
      },
      devApplicationURLs,
    })

    // When
    const manifest = await app.manifest(undefined)

    // Then
    expect(manifest).toEqual({
      name: 'my-app',
      handle: '',
      modules: [
        {
          type: 'app_home_external',
          handle: 'app_home',
          uid: appHome.uid,
          assets: appHome.uid,
          target: appHome.contextValue,
          config: expect.objectContaining({
            app_url: 'https://new-url.io',
          }),
        },
        {
          type: 'app_proxy_external',
          handle: 'app_proxy',
          uid: appProxy.uid,
          assets: appProxy.uid,
          target: appProxy.contextValue,
          config: expect.objectContaining({
            url: 'https://new-proxy-url.io',
            subpath: '/updated-path',
            prefix: 'updated-prefix',
          }),
        },
        {
          type: 'app_access_external',
          handle: 'app_access',
          uid: appAccess.uid,
          assets: appAccess.uid,
          target: appAccess.contextValue,
          config: expect.objectContaining({
            redirect_url_allowlist: ['https://new-url.io/auth/callback'],
          }),
        },
      ],
    })
  })

  test('does not patch URLs when devApplicationURLs is not available', async () => {
    // Given
    const appHome = await testAppHomeConfigExtension()

    const app = await testApp({
      name: 'my-app',
      allExtensions: [appHome],
      configuration: {
        ...DEFAULT_CONFIG,
        client_id: 'test-client-id',
      },
      devApplicationURLs: undefined,
    })

    // When
    const manifest = await app.manifest(undefined)

    // Then
    expect(manifest).toEqual({
      name: 'my-app',
      handle: '',
      modules: [
        {
          type: 'app_home_external',
          handle: 'app_home',
          uid: appHome.uid,
          assets: appHome.uid,
          target: appHome.contextValue,
          config: {
            app_url: 'https://example.com',
            embedded: true,
          },
        },
      ],
    })
  })
})

describe('generateExtensionTypes', () => {
  test('creates a shopify.d.ts for each key in the typeDefinitionsByFile map with combined types', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const ext1Dir = joinPath(tmpDir, 'extensions', 'ext1')
      const ext2Dir = joinPath(tmpDir, 'extensions', 'ext2')

      await mkdir(ext1Dir)
      await mkdir(ext2Dir)

      const uiExtension1 = await testUIExtension({type: 'ui_extension', handle: 'ext1', directory: ext1Dir})
      const uiExtension2 = await testUIExtension({type: 'ui_extension', handle: 'ext2', directory: ext2Dir})

      const app = testApp({
        directory: tmpDir,
        allExtensions: [uiExtension1, uiExtension2],
      })

      // Mock the extension contributions
      vi.spyOn(uiExtension1, 'contributeToSharedTypeFile').mockImplementation(async (typeDefinitionsByFile) => {
        typeDefinitionsByFile.set(
          joinPath(ext1Dir, 'shopify.d.ts'),
          new Set([
            "declare module './ext1-module-1.jsx' { // mocked ext1 module 1 definition }",
            "declare module './ext1-module-2.jsx' { // mocked ext1 module 2 definition }",
          ]),
        )
      })
      vi.spyOn(uiExtension2, 'contributeToSharedTypeFile').mockImplementation(async (typeDefinitionsByFile) => {
        typeDefinitionsByFile.set(
          joinPath(ext2Dir, 'shopify.d.ts'),
          new Set([
            "declare module './ext2-module-1.jsx' { // mocked ext2 module 1 definition }",
            "declare module './ext2-module-2.jsx' { // mocked ext2 module 2 definition }",
          ]),
        )
      })

      // When
      await app.generateExtensionTypes()

      // Then
      const ext1TypeFilePath = joinPath(ext1Dir, 'shopify.d.ts')
      const ext1FileContent = await readFile(ext1TypeFilePath)
      const normalizedExt1Content = ext1FileContent.toString().replace(/\\/g, '/')
      expect(normalizedExt1Content).toBe(`import '@shopify/ui-extensions';\n
declare module './ext1-module-1.jsx' { // mocked ext1 module 1 definition }
declare module './ext1-module-2.jsx' { // mocked ext1 module 2 definition }`)

      const ext2TypeFilePath = joinPath(ext2Dir, 'shopify.d.ts')
      const ext2FileContent = await readFile(ext2TypeFilePath)
      const normalizedExt2Content = ext2FileContent.toString().replace(/\\/g, '/')
      expect(normalizedExt2Content).toBe(`import '@shopify/ui-extensions';\n
declare module './ext2-module-1.jsx' { // mocked ext2 module 1 definition }
declare module './ext2-module-2.jsx' { // mocked ext2 module 2 definition }`)
    })
  })
})

function createPackageJson(tmpDir: string, type: string, version: string) {
  const packagePath = joinPath(tmpDir, 'node_modules', '@shopify', type, 'package.json')
  const packageJson = {name: 'name', version}
  const dirPath = joinPath(tmpDir, 'node_modules', '@shopify', type)
  return mkdir(dirPath).then(() => writeFile(packagePath, JSON.stringify(packageJson)))
}
