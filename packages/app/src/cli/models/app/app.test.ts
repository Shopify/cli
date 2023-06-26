import {getUIExtensionRendererVersion, isCurrentAppSchema, isLegacyAppSchema, isValidAppSchema} from './app.js'
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
}

const CORRECT_LEGACY_APP_SCHEMA = {
  extension_directories: [],
  web_directories: [],
  scopes: 'write_products',
}

describe('app schema validation', () => {
  describe('generic validation', () => {
    test('passes generic schema validation with correct values when schema is legacy', () => {
      expect(isValidAppSchema(CORRECT_LEGACY_APP_SCHEMA, {strict: true})).toBe(true)
    })

    test('passes generic schema validation with correct values when schema is current', () => {
      expect(isValidAppSchema(CORRECT_CURRENT_APP_SCHEMA, {strict: true})).toBe(true)
    })

    test('passes schema validation if invalid key is present and strict mode is off', () => {
      const config = {
        ...CORRECT_LEGACY_APP_SCHEMA,
        invalid_key: 'i will succeed, i will be stripped out!',
      }
      expect(isValidAppSchema(config)).toBe(true)
    })

    test('fails schema validation if invalid key is present and strict mode is on', () => {
      const config = {
        ...CORRECT_LEGACY_APP_SCHEMA,
        invalid_key: 'i will fail, i am not in the schema!',
      }
      expect(isValidAppSchema(config, {strict: true})).toBe(false)
    })

    test('fails schema validation if invalid value for valid key is present', () => {
      const config = {
        ...CORRECT_LEGACY_APP_SCHEMA,
        // woops!
        scopes: 12,
      }
      expect(isValidAppSchema(config)).toBe(false)
    })
  })

  describe('legacy schema validator', () => {
    test('checks whether legacy app schema is valid with strict mode off', () => {
      const config = {
        ...CORRECT_LEGACY_APP_SCHEMA,
        some_other_key: 'i am not valid, but strict is off',
      }
      expect(isLegacyAppSchema(config)).toBe(true)
    })
    test('checks whether legacy app schema is valid with strict mode on -- fail', () => {
      const config = {
        ...CORRECT_LEGACY_APP_SCHEMA,
        some_other_key: 'i am not valid, but strict is on, so i fail',
      }
      expect(isLegacyAppSchema(config, {strict: true})).toBe(false)
    })
    test('checks whether legacy app schema is valid with strict mode on -- pass', () => {
      expect(isLegacyAppSchema(CORRECT_LEGACY_APP_SCHEMA, {strict: true})).toBe(true)
    })
  })

  describe('current schema validator', () => {
    test('checks whether current app schema is valid with strict mode off', () => {
      const config = {
        ...CORRECT_CURRENT_APP_SCHEMA,
        some_other_key: 'i am not valid, but strict is off',
      }

      expect(isCurrentAppSchema(config)).toBe(true)
    })
    test('checks whether current app schema is valid with strict mode on -- fail', () => {
      const config = {
        ...CORRECT_CURRENT_APP_SCHEMA,
        some_other_key: 'i am not valid, but strict is on, so i fail',
      }
      expect(isCurrentAppSchema(config, {strict: true})).toBe(false)
    })
    test('checks whether current app schema is valid with strict mode on -- pass', () => {
      const config = {
        ...CORRECT_CURRENT_APP_SCHEMA,
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
      expect(isCurrentAppSchema(config, {strict: true})).toBe(true)
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
