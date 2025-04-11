import {
  patchAppHiddenConfigFile,
  setAppConfigValue,
  unsetAppConfigValue,
  setManyAppConfigValues,
} from './patch-app-configuration-file.js'
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

describe('setAppConfigValue', () => {
  test('sets a top-level value in the configuration', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const configPath = writeDefaulToml(tmpDir)

      await setAppConfigValue(configPath, 'name', 'Updated App Name', schema)

      const updatedTomlFile = await readFile(configPath)
      expect(updatedTomlFile).toContain('name = "Updated App Name"')
    })
  })

  test('sets a nested value in the configuration', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const configPath = writeDefaulToml(tmpDir)

      await setAppConfigValue(configPath, 'build.dev_store_url', 'example.myshopify.com', schema)

      const updatedTomlFile = await readFile(configPath)
      expect(updatedTomlFile).toContain('[build]')
      expect(updatedTomlFile).toContain('dev_store_url = "example.myshopify.com"')
    })
  })

  test('sets a deeply nested value in the configuration', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const configPath = writeDefaulToml(tmpDir)

      await setAppConfigValue(configPath, 'build.auth.settings', true, schema)

      const updatedTomlFile = await readFile(configPath)
      expect(updatedTomlFile).toContain('[build.auth]')
      expect(updatedTomlFile).toContain('settings = true')
    })
  })
})

describe('unsetAppConfigValue', () => {
  test('unsets a top-level value in the configuration', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const configPath = writeDefaulToml(tmpDir)

      await unsetAppConfigValue(configPath, 'name', schema)

      const updatedTomlFile = await readFile(configPath)
      expect(updatedTomlFile).not.toContain('name = "app1"')
    })
  })

  test('unsets a nested value in existing table in the configuration', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const configPath = writeDefaulToml(tmpDir)

      // Add a value first
      await setAppConfigValue(configPath, 'build.dev_store_url', 'example.myshopify.com', schema)

      // Now unset it
      await unsetAppConfigValue(configPath, 'build.dev_store_url', schema)

      const updatedTomlFile = await readFile(configPath)
      expect(updatedTomlFile).toContain('[build]')
      expect(updatedTomlFile).not.toContain('dev_store_url = "example.myshopify.com"')
    })
  })
})

describe('setManyAppConfigValues', () => {
  test('sets multiple top-level values in the configuration', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const configPath = writeDefaulToml(tmpDir)

      await setManyAppConfigValues(
        configPath,
        [
          {keyPath: 'name', value: 'Updated App Name'},
          {keyPath: 'client_id', value: '67890'},
        ],
        schema,
      )

      const updatedTomlFile = await readFile(configPath)
      expect(updatedTomlFile).toContain('name = "Updated App Name"')
      expect(updatedTomlFile).toContain('client_id = "67890"')
    })
  })

  test('sets a mix of top-level and nested values in the configuration', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const configPath = writeDefaulToml(tmpDir)

      await setManyAppConfigValues(
        configPath,
        [
          {keyPath: 'name', value: 'Updated App Name'},
          {keyPath: 'build.dev_store_url', value: 'example.myshopify.com'},
        ],
        schema,
      )

      const updatedTomlFile = await readFile(configPath)
      expect(updatedTomlFile).toContain('name = "Updated App Name"')
      expect(updatedTomlFile).toContain('[build]')
      expect(updatedTomlFile).toContain('dev_store_url = "example.myshopify.com"')
    })
  })

  test('properly handles array values in the configuration', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const configPath = writeDefaulToml(tmpDir)

      await setManyAppConfigValues(
        configPath,
        [{keyPath: 'auth.redirect_urls', value: ['https://example.com/redirect3', 'https://example.com/redirect4']}],
        schema,
      )

      const updatedTomlFile = await readFile(configPath)
      expect(updatedTomlFile).toContain('[auth]')
      expect(updatedTomlFile).toContain('redirect_urls = [')
      expect(updatedTomlFile).toContain('"https://example.com/redirect3"')
      expect(updatedTomlFile).toContain('"https://example.com/redirect4"')
      expect(updatedTomlFile).not.toContain('"https://example.com/redirect"')
      expect(updatedTomlFile).not.toContain('"https://example.com/redirect2"')
    })
  })

  test('combines multiple nested keys into a single object structure', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const configPath = writeDefaulToml(tmpDir)

      await setManyAppConfigValues(
        configPath,
        [
          {keyPath: 'build.dev_store_url', value: 'example.myshopify.com'},
          {keyPath: 'build.automatically_update_urls_on_dev', value: true},
        ],
        schema,
      )

      const updatedTomlFile = await readFile(configPath)
      expect(updatedTomlFile).toContain('[build]')
      expect(updatedTomlFile).toContain('dev_store_url = "example.myshopify.com"')
      expect(updatedTomlFile).toContain('automatically_update_urls_on_dev = true')
    })
  })

  test('updates existing configuration with new values and replaces arrays', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const configPath = writeDefaulToml(tmpDir)

      await setManyAppConfigValues(
        configPath,
        [
          {keyPath: 'name', value: 'Updated App Name'},
          {keyPath: 'application_url', value: 'https://example.com'},
          {keyPath: 'access_scopes.use_legacy_install_flow', value: false},
          {keyPath: 'auth.redirect_urls', value: ['https://example.com/redirect3', 'https://example.com/redirect4']},
        ],
        schema,
      )

      const updatedTomlFile = await readFile(configPath)
      expect(updatedTomlFile).toContain('name = "Updated App Name"')
      expect(updatedTomlFile).toContain('application_url = "https://example.com"')
      expect(updatedTomlFile).toContain('use_legacy_install_flow = false')
      expect(updatedTomlFile).toContain('redirect_urls = [')
      expect(updatedTomlFile).toContain('"https://example.com/redirect3"')
      expect(updatedTomlFile).toContain('"https://example.com/redirect4"')
      expect(updatedTomlFile).not.toContain('"https://example.com/redirect"')
    })
  })
})
