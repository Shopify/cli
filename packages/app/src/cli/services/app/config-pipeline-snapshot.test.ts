import {writeAppConfigurationFile} from './write-app-configuration-file.js'
import {buildVersionedAppSchema} from '../../models/app/app.test-data.js'
import {CurrentAppConfiguration, getAppVersionedSchema} from '../../models/app/app.js'
import {parseConfigurationFile} from '../../models/app/loader.js'
import {inTemporaryDirectory, readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import type {zod} from '@shopify/cli-kit/node/schema'

async function parseConfigAsCurrentApp(schema: zod.ZodTypeAny, filePath: string): Promise<CurrentAppConfiguration> {
  const result = await parseConfigurationFile(schema, filePath)
  if (result.errors) throw new Error(result.errors.map((err) => err.message).join('\n'))
  return result.data as CurrentAppConfiguration
}

/**
 * Snapshot tests for the config pipeline (write → read → write).
 *
 * These verify that:
 * 1. A config read back after writing round-trips cleanly (or documents known asymmetries)
 * 2. The webhook expansion/condensation cycle produces stable output
 * 3. Edge cases around webhook merging (filters, include_fields, compliance) behave predictably
 *
 * These tests serve as the long-term regression suite for config pipeline behavior.
 * If any of them break, the change altered externally-visible config file output.
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
    required_scopes: ['read_products'],
    optional_scopes: ['write_orders'],
  },
  access: {
    admin: {
      direct_api_mode: 'online',
      embedded_app_direct_api_access: true,
    },
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
  test('config round-trip (write → read → write) reorders webhook subscriptions', async () => {
    // KNOWN ASYMMETRY: The current pipeline does NOT round-trip cleanly.
    // mergeAllWebhooks() sorts compliance subscriptions first during parse,
    // so the second write has a different subscription order than the first.
    // This test documents the current behavior as a snapshot.
    await inTemporaryDirectory(async (tmp) => {
      const filePath = joinPath(tmp, 'shopify.app.toml')
      const {configSpecifications: specs} = await buildVersionedAppSchema()

      // First write
      await writeAppConfigurationFile(REALISTIC_CONFIG as CurrentAppConfiguration, filePath)

      // Read back through the full parse pipeline (which fires Zod transforms)
      const parsedConfig = await parseConfigAsCurrentApp(getAppVersionedSchema(specs), filePath)

      // Second write from the parsed (transformed) config
      await writeAppConfigurationFile(parsedConfig, filePath)
      const secondWrite = await readFile(filePath)

      // Snapshot the round-tripped output — it differs from the first write
      // because compliance subscriptions get sorted first by mergeAllWebhooks
      expect(secondWrite).toMatchSnapshot()
    })
  })

  test('config round-trip stabilizes after second write', async () => {
    // After the first round-trip reorders subscriptions, subsequent
    // round-trips should be stable (idempotent).
    await inTemporaryDirectory(async (tmp) => {
      const filePath = joinPath(tmp, 'shopify.app.toml')
      const {configSpecifications: specs} = await buildVersionedAppSchema()

      // First write + read + second write (reordering happens here)
      await writeAppConfigurationFile(REALISTIC_CONFIG as CurrentAppConfiguration, filePath)
      const parsed1 = await parseConfigAsCurrentApp(getAppVersionedSchema(specs), filePath)
      await writeAppConfigurationFile(parsed1, filePath)
      const secondWrite = await readFile(filePath)

      // Third write from re-read — should be identical to second
      const parsed2 = await parseConfigAsCurrentApp(getAppVersionedSchema(specs), filePath)
      await writeAppConfigurationFile(parsed2, filePath)
      const thirdWrite = await readFile(filePath)

      expect(thirdWrite).toEqual(secondWrite)
    })
  })

  test('webhook subscriptions with mixed topics and compliance topics produce stable output', async () => {
    await inTemporaryDirectory(async (tmp) => {
      const filePath = joinPath(tmp, 'shopify.app.toml')
      const {configSpecifications: specs} = await buildVersionedAppSchema()

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

      // Snapshot the first write
      await writeAppConfigurationFile(config as CurrentAppConfiguration, filePath)
      const firstWrite = await readFile(filePath)
      expect(firstWrite).toMatchSnapshot()

      // Round-trip to verify reordering behavior on the most complex fixture
      const parsedConfig = await parseConfigAsCurrentApp(getAppVersionedSchema(specs), filePath)
      await writeAppConfigurationFile(parsedConfig, filePath)
      const secondWrite = await readFile(filePath)
      expect(secondWrite).toMatchSnapshot()
    })
  })

  // First write uses JS object insertion order (no schema-driven rewriting).
  // A Zod parse round-trip reorders keys to schema order, so the first round-trip may differ.
  // Stability is guaranteed from the second write onward.
  test('config with relative webhook URIs stabilizes after round-trip', async () => {
    await inTemporaryDirectory(async (tmp) => {
      const filePath = joinPath(tmp, 'shopify.app.toml')
      const {configSpecifications: specs} = await buildVersionedAppSchema()

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

      // Write, read, write (first round-trip may reorder)
      await writeAppConfigurationFile(config as CurrentAppConfiguration, filePath)
      const parsed1 = await parseConfigAsCurrentApp(getAppVersionedSchema(specs), filePath)
      await writeAppConfigurationFile(parsed1, filePath)
      const secondWrite = await readFile(filePath)

      // Third write should be stable
      const parsed2 = await parseConfigAsCurrentApp(getAppVersionedSchema(specs), filePath)
      await writeAppConfigurationFile(parsed2, filePath)
      const thirdWrite = await readFile(filePath)

      expect(thirdWrite).toEqual(secondWrite)
    })
  })

  test('minimal config without webhooks produces stable output', async () => {
    await inTemporaryDirectory(async (tmp) => {
      const filePath = joinPath(tmp, 'shopify.app.toml')

      const config = {
        client_id: '12345',
        name: 'Minimal App',
        application_url: 'https://example.com',
        embedded: true,
        access_scopes: {
          scopes: 'read_products',
        },
        auth: {
          redirect_urls: ['https://example.com/auth/callback'],
        },
      } satisfies CurrentAppConfiguration

      await writeAppConfigurationFile(config, filePath)
      const content = await readFile(filePath)
      expect(content).toMatchSnapshot()
    })
  })

  // First write uses JS object insertion order (no schema-driven rewriting).
  // A Zod parse round-trip reorders keys to schema order, so the first round-trip may differ.
  // Stability is guaranteed from the second write onward.
  test('subscriptions with same URI but different filters stay separate through round-trip', async () => {
    await inTemporaryDirectory(async (tmp) => {
      const filePath = joinPath(tmp, 'shopify.app.toml')
      const {configSpecifications: specs} = await buildVersionedAppSchema()

      const config = {
        ...REALISTIC_CONFIG,
        webhooks: {
          api_version: '2024-01',
          subscriptions: [
            {topics: ['orders/create'], uri: '/webhooks/orders', filter: 'status:paid'},
            {topics: ['orders/update'], uri: '/webhooks/orders', filter: 'status:pending'},
          ],
        },
      }

      await writeAppConfigurationFile(config as CurrentAppConfiguration, filePath)
      const firstWrite = await readFile(filePath)
      expect(firstWrite).toMatchSnapshot()

      // Round-trip: write → read → write → read → write (stabilizes after first round-trip)
      const parsed1 = await parseConfigAsCurrentApp(getAppVersionedSchema(specs), filePath)
      await writeAppConfigurationFile(parsed1, filePath)
      const secondWrite = await readFile(filePath)

      const parsed2 = await parseConfigAsCurrentApp(getAppVersionedSchema(specs), filePath)
      await writeAppConfigurationFile(parsed2, filePath)
      const thirdWrite = await readFile(filePath)

      expect(thirdWrite).toEqual(secondWrite)
    })
  })

  // First write uses JS object insertion order (no schema-driven rewriting).
  // A Zod parse round-trip reorders keys to schema order, so the first round-trip may differ.
  // Stability is guaranteed from the second write onward.
  test('subscriptions with same URI but different include_fields stay separate through round-trip', async () => {
    await inTemporaryDirectory(async (tmp) => {
      const filePath = joinPath(tmp, 'shopify.app.toml')
      const {configSpecifications: specs} = await buildVersionedAppSchema()

      const config = {
        ...REALISTIC_CONFIG,
        webhooks: {
          api_version: '2024-01',
          subscriptions: [
            {topics: ['products/create'], uri: '/webhooks/products', include_fields: ['id', 'title']},
            {topics: ['products/update'], uri: '/webhooks/products', include_fields: ['id']},
          ],
        },
      }

      await writeAppConfigurationFile(config as CurrentAppConfiguration, filePath)
      const firstWrite = await readFile(filePath)
      expect(firstWrite).toMatchSnapshot()

      // Round-trip: stabilizes after first round-trip
      const parsed1 = await parseConfigAsCurrentApp(getAppVersionedSchema(specs), filePath)
      await writeAppConfigurationFile(parsed1, filePath)
      const secondWrite = await readFile(filePath)

      const parsed2 = await parseConfigAsCurrentApp(getAppVersionedSchema(specs), filePath)
      await writeAppConfigurationFile(parsed2, filePath)
      const thirdWrite = await readFile(filePath)

      expect(thirdWrite).toEqual(secondWrite)
    })
  })

  test('subscription with both topics and compliance_topics on same URI splits after round-trip', async () => {
    await inTemporaryDirectory(async (tmp) => {
      const filePath = joinPath(tmp, 'shopify.app.toml')
      const {configSpecifications: specs} = await buildVersionedAppSchema()

      const config = {
        ...REALISTIC_CONFIG,
        webhooks: {
          api_version: '2024-01',
          subscriptions: [
            {
              topics: ['orders/create'],
              compliance_topics: ['customers/data_request', 'customers/redact'],
              uri: '/webhooks',
            },
          ],
        },
      }

      await writeAppConfigurationFile(config as CurrentAppConfiguration, filePath)
      const firstWrite = await readFile(filePath)

      const parsedConfig = await parseConfigAsCurrentApp(getAppVersionedSchema(specs), filePath)
      await writeAppConfigurationFile(parsedConfig, filePath)
      const secondWrite = await readFile(filePath)

      // After round-trip, compliance and regular topics should be split into separate subscriptions
      expect(secondWrite).toMatchSnapshot()
    })
  })
})
