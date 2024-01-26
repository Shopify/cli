import {writeAppConfigurationFile} from './write-app-configuration-file.js'
import {DEFAULT_CONFIG, buildVersionedAppSchema} from '../../models/app/app.test-data.js'
import {CurrentAppConfiguration} from '../../models/app/app.js'
import {inTemporaryDirectory, readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'

const FULL_CONFIGURATION = {
  build: {
    include_config_on_deploy: true,
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
      const {schema} = await buildVersionedAppSchema()

      // When
      await writeAppConfigurationFile({...FULL_CONFIGURATION, path: filePath}, schema)

      // Then
      const content = await readFile(filePath)
      const expectedContent = `# Learn more about configuring your app at https://shopify.dev/docs/apps/tools/cli/configuration

client_id = "12345"
name = "my app"
application_url = "https://myapp.com"
embedded = true

[build]
automatically_update_urls_on_dev = true
dev_store_url = "example.myshopify.com"
include_config_on_deploy = true

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
`
      expect(content).toEqual(expectedContent)
    })
  })

  test('does not include empty entries in config file', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const filePath = joinPath(tmp, 'shopify.app.toml')
      const {schema} = await buildVersionedAppSchema()

      // When
      await writeAppConfigurationFile(
        {
          ...FULL_CONFIGURATION,
          path: filePath,
          build: undefined,
          app_preferences: undefined,
          pos: undefined,
          webhooks: {
            api_version: '2023-04',
            privacy_compliance: {},
          },
        } as CurrentAppConfiguration,
        schema,
      )

      // Then
      const content = await readFile(filePath)
      expect(content).not.toContain('[build]')
      expect(content).not.toContain('[app_preferences]')
      expect(content).not.toContain('[pos]')
      expect(content).not.toContain('privacy_compliance')
    })
  })
})
