import {writeAppConfigurationFile} from './write-app-configuration-file.js'
import {DEFAULT_CONFIG} from '../../models/app/app.test-data.js'
import {inTemporaryDirectory, readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'

const FULL_CONFIGURATION = {
  build: {
    automatically_update_urls_on_dev: true,
    dev_store_url: 'example.myshopify.com',
  },
  ...DEFAULT_CONFIG,
  auth: {redirect_urls: ['https://example.com/redirect', 'https://example.com/redirect2']},
  webhooks: {
    api_version: '2023-07',
    privacy_compliance: {
      customer_deletion_url: 'https://example.com/auth/callback1',
      customer_data_request_url: 'https://example.com/auth/callback2',
      shop_deletion_url: 'https://example.com/auth/callback3',
    },
  },
  app_proxy: {
    url: 'https://example.com/auth/prox',
    subpath: 'asdsa',
    prefix: 'community',
  },
  pos: {
    embedded: false,
  },
  app_preferences: {
    url: 'https://example.com/prefs',
  },
}

describe('writeAppConfigurationFile', () => {
  test('writes app config with comments', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const filePath = joinPath(tmp, 'shopify.app.toml')

      // When
      const got = await writeAppConfigurationFile({...FULL_CONFIGURATION, path: filePath})

      // Then
      const content = await readFile(filePath)
      const expectedContent = `# Learn more about configuring your app at https://shopify.dev/docs/apps/tools/cli/configuration

name = "my app"
client_id = "12345"
application_url = "https://myapp.com"
embedded = true

[access_scopes]
# Learn more at https://shopify.dev/docs/apps/tools/cli/configuration#access_scopes
scopes = "read_products"

[auth]
redirect_urls = [
  "https://example.com/redirect",
  "https://example.com/redirect2"
]

[webhooks]
api_version = "2023-07"

  [webhooks.privacy_compliance]
  customer_deletion_url = "https://example.com/auth/callback1"
  customer_data_request_url = "https://example.com/auth/callback2"
  shop_deletion_url = "https://example.com/auth/callback3"

[app_proxy]
url = "https://example.com/auth/prox"
subpath = "asdsa"
prefix = "community"

[pos]
embedded = false

[app_preferences]
url = "https://example.com/prefs"

[build]
automatically_update_urls_on_dev = true
dev_store_url = "example.myshopify.com"
`
      expect(content).toEqual(expectedContent)
    })
  })

  test('writes app config with app access module when remote module is available', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const filePath = joinPath(tmp, 'shopify.app.toml')

      // When
      const got = await writeAppConfigurationFile({
        ...FULL_CONFIGURATION,
        path: filePath,
        access: {api_access: {mode: 'offline'}},
      })

      // Then
      const content = await readFile(filePath)
      const expectedContent = `# Learn more about configuring your app at https://shopify.dev/docs/apps/tools/cli/configuration

name = "my app"
client_id = "12345"
application_url = "https://myapp.com"
embedded = true

[access.api_access]
mode = "offline"

[access_scopes]
# Learn more at https://shopify.dev/docs/apps/tools/cli/configuration#access_scopes
scopes = "read_products"

[auth]
redirect_urls = [
  "https://example.com/redirect",
  "https://example.com/redirect2"
]

[webhooks]
api_version = "2023-07"

  [webhooks.privacy_compliance]
  customer_deletion_url = "https://example.com/auth/callback1"
  customer_data_request_url = "https://example.com/auth/callback2"
  shop_deletion_url = "https://example.com/auth/callback3"

[app_proxy]
url = "https://example.com/auth/prox"
subpath = "asdsa"
prefix = "community"

[pos]
embedded = false

[app_preferences]
url = "https://example.com/prefs"

[build]
automatically_update_urls_on_dev = true
dev_store_url = "example.myshopify.com"
`
      expect(content).toEqual(expectedContent)
    })
  })

  test('does not include empty entries in config file', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const filePath = joinPath(tmp, 'shopify.app.toml')

      // When
      const got = await writeAppConfigurationFile({
        ...FULL_CONFIGURATION,
        path: filePath,
        build: undefined,
        app_preferences: undefined,
        pos: undefined,
        webhooks: {
          api_version: '2023-04',
          privacy_compliance: {},
        },
      })

      // Then
      const content = await readFile(filePath)
      expect(content).not.toContain('[build]')
      expect(content).not.toContain('[app_preferences]')
      expect(content).not.toContain('[pos]')
      expect(content).not.toContain('privacy_compliance')
    })
  })
})
