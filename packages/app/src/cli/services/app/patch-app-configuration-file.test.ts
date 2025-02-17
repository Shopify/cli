import {patchAppConfigurationFile, patchAppHiddenConfigFile} from './patch-app-configuration-file.js'
import {getAppVersionedSchema} from '../../models/app/app.js'
import {loadLocalExtensionsSpecifications} from '../../models/extensions/load-specifications.js'
import {readFile, writeFileSync, inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'

const defaultToml = `# Learn more about configuring your app at https://shopify.dev/docs/apps/tools/cli/configuration
client_id = "12345"
name = "app1"
application_url = "https://example.com"
embedded = true

[access_scopes]
# Learn more at https://shopify.dev/docs/apps/tools/cli/configuration#access_scopes
use_legacy_install_flow = true

[auth]
redirect_urls = [
  "https://example.com/redirect",
  "https://example.com/redirect2"
]

[webhooks]
api_version = "2023-04"
`

const schema = getAppVersionedSchema(await loadLocalExtensionsSpecifications(), false)

function writeDefaulToml(tmpDir: string) {
  const configPath = joinPath(tmpDir, 'shopify.app.toml')
  writeFileSync(configPath, defaultToml)
  return configPath
}

describe('patchAppConfigurationFile', () => {
  test('updates existing configuration with new values and adds new top-levelfields, replaces arrays', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const configPath = writeDefaulToml(tmpDir)
      const patch = {
        name: 'Updated App Name',
        application_url: 'https://example.com',
        access_scopes: {
          use_legacy_install_flow: false,
        },
        auth: {
          redirect_urls: ['https://example.com/redirect3', 'https://example.com/redirect4'],
        },
      }

      await patchAppConfigurationFile({path: configPath, patch, schema})

      const updatedTomlFile = await readFile(configPath)
      expect(updatedTomlFile)
        .toEqual(`# Learn more about configuring your app at https://shopify.dev/docs/apps/tools/cli/configuration

client_id = "12345"
name = "Updated App Name"
application_url = "https://example.com"
embedded = true

[access_scopes]
# Learn more at https://shopify.dev/docs/apps/tools/cli/configuration#access_scopes
use_legacy_install_flow = false

[auth]
redirect_urls = [
  "https://example.com/redirect3",
  "https://example.com/redirect4"
]

[webhooks]
api_version = "2023-04"
`)
    })
  })

  test('Adds new table to the toml file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const configPath = writeDefaulToml(tmpDir)
      const patch = {
        application_url: 'https://example.com',
        build: {
          dev_store_url: 'example.myshopify.com',
        },
      }

      await patchAppConfigurationFile({path: configPath, patch, schema})

      const updatedTomlFile = await readFile(configPath)
      expect(updatedTomlFile)
        .toEqual(`# Learn more about configuring your app at https://shopify.dev/docs/apps/tools/cli/configuration

client_id = "12345"
name = "app1"
application_url = "https://example.com"
embedded = true

[access_scopes]
# Learn more at https://shopify.dev/docs/apps/tools/cli/configuration#access_scopes
use_legacy_install_flow = true

[auth]
redirect_urls = [
  "https://example.com/redirect",
  "https://example.com/redirect2"
]

[webhooks]
api_version = "2023-04"

[build]
dev_store_url = "example.myshopify.com"
`)
    })
  })

  test('Adds a new field to a toml table, merging with exsisting values', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const configPath = writeDefaulToml(tmpDir)
      const patch = {
        application_url: 'https://example.com',
        access_scopes: {
          scopes: 'read_products',
        },
      }

      await patchAppConfigurationFile({path: configPath, patch, schema})

      const updatedTomlFile = await readFile(configPath)
      expect(updatedTomlFile)
        .toEqual(`# Learn more about configuring your app at https://shopify.dev/docs/apps/tools/cli/configuration

client_id = "12345"
name = "app1"
application_url = "https://example.com"
embedded = true

[access_scopes]
# Learn more at https://shopify.dev/docs/apps/tools/cli/configuration#access_scopes
use_legacy_install_flow = true
scopes = "read_products"

[auth]
redirect_urls = [
  "https://example.com/redirect",
  "https://example.com/redirect2"
]

[webhooks]
api_version = "2023-04"
`)
    })
  })

  test('does not validate the toml if no schema is provided', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const configPath = joinPath(tmpDir, 'shopify.app.toml')
      writeFileSync(
        configPath,
        `
random_toml_field = "random_value"
`,
      )
      const patch = {name: 123}

      await patchAppConfigurationFile({path: configPath, patch, schema: undefined})

      const updatedTomlFile = await readFile(configPath)
      expect(updatedTomlFile)
        .toEqual(`# Learn more about configuring your app at https://shopify.dev/docs/apps/tools/cli/configuration

random_toml_field = "random_value"
name = 123
`)
    })
  })
})

describe('patchAppHiddenConfigFile', () => {
  test('creates a new hidden config file when it does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const configPath = joinPath(tmpDir, '.project.json')
      const clientId = '12345'
      const config = {
        dev_store_url: 'test-store.myshopify.com',
      }

      await patchAppHiddenConfigFile(configPath, clientId, config)

      const updatedJsonFile = await readFile(configPath)
      expect(JSON.parse(updatedJsonFile)).toEqual({
        '12345': {
          dev_store_url: 'test-store.myshopify.com',
        },
      })
    })
  })

  test('updates existing hidden config file with new values', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const configPath = joinPath(tmpDir, '.project.json')
      // Write initial config
      const initialConfig = {
        '12345': {
          dev_store_url: 'old-store.myshopify.com',
        },
      }
      writeFileSync(configPath, JSON.stringify(initialConfig, null, 2))

      const clientId = '12345'
      const config = {
        dev_store_url: 'new-store.myshopify.com',
      }

      await patchAppHiddenConfigFile(configPath, clientId, config)

      const updatedJsonFile = await readFile(configPath)
      expect(JSON.parse(updatedJsonFile)).toEqual({
        '12345': {
          dev_store_url: 'new-store.myshopify.com',
        },
      })
    })
  })

  test('preserves other client configurations when updating', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const configPath = joinPath(tmpDir, '.project.json')
      // Write initial config with multiple clients
      const initialConfig = {
        '12345': {
          dev_store_url: 'store-1.myshopify.com',
        },
        '67890': {
          dev_store_url: 'store-2.myshopify.com',
        },
      }
      writeFileSync(configPath, JSON.stringify(initialConfig, null, 2))

      const clientId = '12345'
      const config = {
        dev_store_url: 'updated-store.myshopify.com',
      }

      await patchAppHiddenConfigFile(configPath, clientId, config)

      const updatedJsonFile = await readFile(configPath)
      expect(JSON.parse(updatedJsonFile)).toEqual({
        '12345': {
          dev_store_url: 'updated-store.myshopify.com',
        },
        '67890': {
          dev_store_url: 'store-2.myshopify.com',
        },
      })
    })
  })
})
