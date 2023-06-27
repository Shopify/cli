import {getUIExtensionRendererVersion, isCurrentAppSchema, isLegacyAppSchema} from './app.js'
import {testApp, testUIExtension} from './app.test-data.js'
import {describe, expect, test} from 'vitest'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

const DEFAULT_APP = testApp()

const CORRECT_CURRENT_APP_SCHEMA = {
  name: 'app 1',
  api_contact_email: 'ryan@shopify.com',
  client_id: '12345',
  webhook_api_version: '02-2023',
  application_url: 'http://example.com',
  embedded: true,
  auth: {
    redirect_urls: ['https://google.com'],
  },
  privacy_compliance_webhooks: {
    customer_deletion_url: 'https://google.com/',
    customer_data_request_url: 'https://google.com/',
    shop_deletion_url: 'https://google.com/',
  },
  proxy: {
    url: 'https://google.com/',
    subpath: 'https://google.com/',
    prefix: 'https://google.com/',
  },
  pos: {
    embedded: false,
  },
  app_preferences: {
    url: 'https://google.com/',
  },
  cli: {
    automatically_update_urls_on_dev: true,
    dev_store_url: 'https://google.com/',
  },
}

const CORRECT_LEGACY_APP_SCHEMA = {
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
        bad_key: 'i will fail',
      }
      expect(isCurrentAppSchema(config)).toBe(false)
    })
    test('checks whether current app schema is valid -- fail', () => {
      const config = {
        ...CORRECT_CURRENT_APP_SCHEMA,
      }

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      delete config.name

      expect(isCurrentAppSchema(config)).toBe(false)
    })
  })
})

describe('getUIExtensionRendererVersion', () => {
  test('returns the version of the dependency package for product_subscription', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await createPackageJson(tmpDir, 'admin-ui-extensions', '2.4.5')
      DEFAULT_APP.directory = tmpDir
      const extension = await testUIExtension({type: 'product_subscription'})

      // When
      const got = await getUIExtensionRendererVersion(extension, DEFAULT_APP)

      // Then
      expect(got).not.toEqual('not-found')
      if (got === 'not_found') return
      expect(got?.name).to.toEqual('@shopify/admin-ui-extensions')
      expect(got?.version).toEqual('2.4.5')
    })
  })

  test('returns the version of the dependency package for checkout_ui_extension', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await createPackageJson(tmpDir, 'checkout-ui-extensions', '1.4.5')
      DEFAULT_APP.directory = tmpDir
      const extension = await testUIExtension({type: 'checkout_ui_extension'})

      // When
      const got = await getUIExtensionRendererVersion(extension, DEFAULT_APP)

      // Then
      expect(got).not.toEqual('not-found')
      if (got === 'not_found') return
      expect(got?.name).to.toEqual('@shopify/checkout-ui-extensions')
      expect(got?.version).toEqual('1.4.5')
    })
  })

  test('returns the version of the dependency package for checkout_post_purchase', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await createPackageJson(tmpDir, 'post-purchase-ui-extensions', '3.4.5')
      DEFAULT_APP.directory = tmpDir
      const extension = await testUIExtension({type: 'checkout_post_purchase'})

      // When
      const got = await getUIExtensionRendererVersion(extension, DEFAULT_APP)

      // Then
      expect(got).not.toEqual('not-found')
      if (got === 'not_found') return
      expect(got?.name).to.toEqual('@shopify/post-purchase-ui-extensions')
      expect(got?.version).toEqual('3.4.5')
    })
  })

  test('returns the version of the dependency package for web_pixel', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await createPackageJson(tmpDir, '@shopify/web-pixels-extension', '3.4.5')
      DEFAULT_APP.directory = tmpDir
      const extension = await testUIExtension({type: 'web_pixel_extension'})

      // When
      const got = await getUIExtensionRendererVersion(extension, DEFAULT_APP)

      // Then
      expect(got).not.toEqual('not-found')
      if (got === 'not_found') return
      expect(got?.name).to.toEqual('@shopify/web-pixels-extension')
      expect(got?.version).toEqual('3.4.5')
    })
  })

  test('returns not_found if there is no renderer package', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      DEFAULT_APP.directory = tmpDir
      const extension = await testUIExtension({type: 'product_subscription'})

      // When
      const got = await getUIExtensionRendererVersion(extension, DEFAULT_APP)

      // Then
      expect(got).toEqual('not_found')
    })
  })
})

function createPackageJson(tmpDir: string, type: string, version: string) {
  const packagePath = joinPath(tmpDir, 'node_modules', '@shopify', type, 'package.json')
  const packageJson = {name: 'name', version}
  const dirPath = joinPath(tmpDir, 'node_modules', '@shopify', type)
  return mkdir(dirPath).then(() => writeFile(packagePath, JSON.stringify(packageJson)))
}
