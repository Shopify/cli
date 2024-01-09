import {
  CurrentAppConfiguration,
  LegacyAppConfiguration,
  getAppScopes,
  getAppScopesArray,
  getUIExtensionRendererVersion,
  isCurrentAppSchema,
  isLegacyAppSchema,
  validateFunctionExtensionsWithUiHandle,
} from './app.js'
import {DEFAULT_CONFIG, testApp, testUIExtension, testFunctionExtension} from './app.test-data.js'
import {ExtensionInstance} from '../extensions/extension-instance.js'
import {FunctionConfigType} from '../extensions/specifications/function.js'
import {describe, expect, test} from 'vitest'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

const DEFAULT_APP = testApp()

const CORRECT_CURRENT_APP_SCHEMA: CurrentAppConfiguration = {
  path: '',
  name: 'app 1',
  client_id: '12345',
  webhooks: {
    api_version: '2023-04',
    privacy_compliance: {
      customer_deletion_url: 'https://google.com',
      customer_data_request_url: 'https://google.com',
      shop_deletion_url: 'https://google.com',
    },
  },
  application_url: 'http://example.com',
  embedded: true,
  auth: {
    redirect_urls: ['https://google.com'],
  },
  app_proxy: {
    url: 'https://google.com',
    subpath: 'https://google.com',
    prefix: 'https://google.com',
  },
  pos: {
    embedded: false,
  },
  app_preferences: {
    url: 'https://google.com',
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

describe('validateFunctionExtensionsWithUiHandle', () => {
  const generateFunctionConfig = ({type, uiHandle}: {type?: string; uiHandle?: string}): FunctionConfigType => ({
    description: 'description',
    build: {
      command: 'echo "hello world"',
    },
    api_version: '2022-07',
    configuration_ui: true,
    metafields: [],
    name: 'test function extension',
    type: type || 'product_discounts',
    ui: {
      handle: uiHandle || 'test-ui-handle',
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

function createPackageJson(tmpDir: string, type: string, version: string) {
  const packagePath = joinPath(tmpDir, 'node_modules', '@shopify', type, 'package.json')
  const packageJson = {name: 'name', version}
  const dirPath = joinPath(tmpDir, 'node_modules', '@shopify', type)
  return mkdir(dirPath).then(() => writeFile(packagePath, JSON.stringify(packageJson)))
}
