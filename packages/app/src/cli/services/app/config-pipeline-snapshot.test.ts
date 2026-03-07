import {writeAppConfigurationFile} from './write-app-configuration-file.js'
import {buildVersionedAppSchema} from '../../models/app/app.test-data.js'
import {CurrentAppConfiguration, getAppVersionedSchema} from '../../models/app/app.js'
import {parseConfigurationFile} from '../../models/app/loader.js'
import {inTemporaryDirectory, readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'

/**
 * These snapshot tests lock the current behavior of the config pipeline.
 * They verify that:
 * 1. writeAppConfigurationFile produces expected TOML output
 * 2. A config read back after writing round-trips cleanly
 * 3. The webhook expansion/condensation cycle produces stable output
 *
 * These tests are the safety net for config model refactoring.
 * If any of them break, the refactor changed external behavior.
 */

const REALISTIC_CONFIG = {
  client_id: '12345',
  name: 'My Test App',
  application_url: 'https://myapp.example.com',
  embedded: true,
  build: {
    automatically_update_urls_on_dev: true,
    dev_store_url: 'test-store.myshopify.com',
    include_config_on_deploy: true,
  },
  access_scopes: {
    scopes: 'read_products,write_orders',
    use_legacy_install_flow: false,
  },
  auth: {
    redirect_urls: ['https://myapp.example.com/auth/callback', 'https://myapp.example.com/auth/shopify/callback'],
  },
  webhooks: {
    api_version: '2024-01',
    subscriptions: [
      {
        topics: ['products/create', 'products/update'],
        uri: '/webhooks/products',
      },
      {
        topics: ['orders/create'],
        uri: 'https://myapp.example.com/webhooks/orders',
      },
      {
        compliance_topics: ['customers/data_request', 'customers/redact'],
        uri: 'https://myapp.example.com/webhooks/compliance',
      },
    ],
  },
  app_proxy: {
    url: 'https://myapp.example.com/proxy',
    subpath: 'app',
    prefix: 'apps',
  },
  pos: {
    embedded: false,
  },
  app_preferences: {
    url: 'https://myapp.example.com/preferences',
  },
}

describe('Config pipeline snapshots', () => {
  test('writeAppConfigurationFile produces stable TOML output for a full config', async () => {
    await inTemporaryDirectory(async (tmp) => {
      const filePath = joinPath(tmp, 'shopify.app.toml')
      const {schema} = await buildVersionedAppSchema()

      await writeAppConfigurationFile(REALISTIC_CONFIG as CurrentAppConfiguration, schema, filePath)

      const content = await readFile(filePath)
      expect(content).toMatchSnapshot()
    })
  })

  test('config round-trip (write → read → write) preserves subscription order', async () => {
    // With the mergeAllWebhooks transform extracted from the Zod schema,
    // the parse pipeline no longer reorders webhook subscriptions.
    // This verifies a clean round-trip: first write === second write.
    await inTemporaryDirectory(async (tmp) => {
      const filePath = joinPath(tmp, 'shopify.app.toml')
      const {schema, configSpecifications: specs} = await buildVersionedAppSchema()

      // First write
      await writeAppConfigurationFile(REALISTIC_CONFIG as CurrentAppConfiguration, schema, filePath)
      const firstWrite = await readFile(filePath)

      // Read back through the full parse pipeline (no more Zod transforms on webhooks)
      const parsedConfig = await parseConfigurationFile(getAppVersionedSchema(specs), filePath)

      // Second write from the parsed config
      await writeAppConfigurationFile(parsedConfig, schema, filePath)
      const secondWrite = await readFile(filePath)

      // Clean round-trip: second write matches the first
      expect(secondWrite).toEqual(firstWrite)
    })
  })

  test('config round-trip stabilizes after second write', async () => {
    // After the first round-trip reorders subscriptions, subsequent
    // round-trips should be stable (idempotent).
    await inTemporaryDirectory(async (tmp) => {
      const filePath = joinPath(tmp, 'shopify.app.toml')
      const {schema, configSpecifications: specs} = await buildVersionedAppSchema()

      // First write + read + second write (reordering happens here)
      await writeAppConfigurationFile(REALISTIC_CONFIG as CurrentAppConfiguration, schema, filePath)
      const parsed1 = await parseConfigurationFile(getAppVersionedSchema(specs), filePath)
      await writeAppConfigurationFile(parsed1, schema, filePath)
      const secondWrite = await readFile(filePath)

      // Third write from re-read — should be identical to second
      const parsed2 = await parseConfigurationFile(getAppVersionedSchema(specs), filePath)
      await writeAppConfigurationFile(parsed2, schema, filePath)
      const thirdWrite = await readFile(filePath)

      expect(thirdWrite).toEqual(secondWrite)
    })
  })

  test('webhook subscriptions with mixed topics and compliance topics produce stable output', async () => {
    await inTemporaryDirectory(async (tmp) => {
      const filePath = joinPath(tmp, 'shopify.app.toml')
      const {schema} = await buildVersionedAppSchema()

      const config = {
        ...REALISTIC_CONFIG,
        webhooks: {
          api_version: '2024-01',
          subscriptions: [
            {
              topics: ['orders/create', 'orders/updated', 'orders/cancelled'],
              uri: '/webhooks/orders',
            },
            {
              topics: ['products/create'],
              uri: '/webhooks/products',
              include_fields: ['id', 'title'],
            },
            {
              compliance_topics: ['customers/data_request', 'customers/redact', 'shop/redact'],
              uri: '/webhooks/compliance',
            },
            {
              topics: ['app/uninstalled'],
              uri: 'https://myapp.example.com/webhooks/app',
            },
          ],
        },
      }

      await writeAppConfigurationFile(config as CurrentAppConfiguration, schema, filePath)
      const content = await readFile(filePath)
      expect(content).toMatchSnapshot()
    })
  })

  test('config with relative webhook URIs normalizes correctly through round-trip', async () => {
    await inTemporaryDirectory(async (tmp) => {
      const filePath = joinPath(tmp, 'shopify.app.toml')
      const {schema, configSpecifications: specs} = await buildVersionedAppSchema()

      const config = {
        ...REALISTIC_CONFIG,
        webhooks: {
          api_version: '2024-01',
          subscriptions: [
            {
              topics: ['products/create'],
              uri: '/webhooks',
            },
          ],
        },
      }

      // Write, read, write
      await writeAppConfigurationFile(config as CurrentAppConfiguration, schema, filePath)
      const firstWrite = await readFile(filePath)

      const parsedConfig = await parseConfigurationFile(getAppVersionedSchema(specs), filePath)
      await writeAppConfigurationFile(parsedConfig, schema, filePath)
      const secondWrite = await readFile(filePath)

      expect(secondWrite).toEqual(firstWrite)
    })
  })

  test('minimal config without webhooks produces stable output', async () => {
    await inTemporaryDirectory(async (tmp) => {
      const filePath = joinPath(tmp, 'shopify.app.toml')
      const {schema} = await buildVersionedAppSchema()

      const config = {
        client_id: '12345',
        name: 'Minimal App',
        application_url: 'https://example.com',
        embedded: true,
        access_scopes: {
          scopes: 'read_products',
        },
      }

      await writeAppConfigurationFile(config as CurrentAppConfiguration, schema, filePath)
      const content = await readFile(filePath)
      expect(content).toMatchSnapshot()
    })
  })
})
