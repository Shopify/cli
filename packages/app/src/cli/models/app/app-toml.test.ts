import {AppToml} from './app-toml.js'
import {
  brandingModule,
  eventsModule,
  webhookSubscriptionModule,
  pointOfSaleModule,
  appHomeModule,
  appAccessModule,
  webhooksModule,
  appProxyModule,
  privacyComplianceWebhooksModule,
  allAppModules,
} from './app-modules/index.js'
import {placeholderAppConfiguration} from './app.test-data.js'
import brandingSpec from '../extensions/specifications/app_config_branding.js'
import eventsSpec from '../extensions/specifications/app_config_events.js'
import posSpec from '../extensions/specifications/app_config_point_of_sale.js'
import appHomeSpec from '../extensions/specifications/app_config_app_home.js'
import appAccessSpec from '../extensions/specifications/app_config_app_access.js'
import webhooksSpec from '../extensions/specifications/app_config_webhook.js'
import appProxySpec from '../extensions/specifications/app_config_app_proxy.js'
import privacyComplianceSpec from '../extensions/specifications/app_config_privacy_compliance_webhooks.js'
import {describe, test, expect} from 'vitest'

const encodeCtx = {appConfiguration: placeholderAppConfiguration, directory: '/tmp', apiKey: 'test'}

// ============================================================================
// Criterion 1: All 9 modules implement the interface
// ============================================================================

describe('all modules implement AppModule interface', () => {
  test.each([
    ['branding', brandingModule],
    ['events', eventsModule],
    ['webhook_subscription', webhookSubscriptionModule],
    ['point_of_sale', pointOfSaleModule],
    ['app_home', appHomeModule],
    ['app_access', appAccessModule],
    ['webhooks', webhooksModule],
    ['app_proxy', appProxyModule],
    ['privacy_compliance_webhooks', privacyComplianceWebhooksModule],
  ])('%s has required properties', (_name, mod) => {
    expect(mod.identifier).toBeTruthy()
    expect(mod.tomlKeys?.length ?? 0).toBeGreaterThan(0)
    expect(mod.extract).toBeTypeOf('function')
    expect(mod.uidStrategy).toMatch(/^(single|dynamic)$/)
  })

  test('allAppModules contains all 9 config modules', () => {
    expect(allAppModules.length).toBe(9)
    const configIds = allAppModules.map((mod) => mod.identifier).sort()
    expect(configIds).toEqual([
      'app_access',
      'app_home',
      'app_proxy',
      'branding',
      'events',
      'point_of_sale',
      'privacy_compliance_webhooks',
      'webhook_subscription',
      'webhooks',
    ])
  })
})

// ============================================================================
// Criterion 2: extract() produces correct slices from full TOML
// ============================================================================

describe('extraction from full TOML config', () => {
  const fullConfig = {
    client_id: '123',
    name: 'my-app',
    handle: 'my-app-handle',
    application_url: 'https://example.com',
    embedded: true,
    app_preferences: {url: 'https://example.com/preferences'},
    access_scopes: {scopes: 'read_products'},
    auth: {redirect_urls: ['https://example.com/callback']},
    access: {admin: {direct_api_mode: 'online' as const}},
    pos: {embedded: true},
    app_proxy: {url: 'https://proxy.com', subpath: 'apps', prefix: 'a'},
    webhooks: {
      api_version: '2024-01',
      subscriptions: [
        {topics: ['orders/create'], uri: 'https://example.com/webhooks'},
        {compliance_topics: ['customers/redact'], uri: 'https://example.com/compliance'},
      ],
    },
    events: {api_version: '2024-01', subscription: [{topic: 'products/update', uri: 'https://example.com/events'}]},
  }

  test('branding extracts name and handle only', () => {
    const result = brandingModule.extract(fullConfig)
    expect(result).toEqual({name: 'my-app', handle: 'my-app-handle'})
  })

  test('point_of_sale extracts only pos key', () => {
    const result = pointOfSaleModule.extract(fullConfig)
    expect(result).toEqual({pos: {embedded: true}})
  })

  test('app_home extracts only its own keys', () => {
    const result = appHomeModule.extract(fullConfig)
    expect(result).toEqual({
      application_url: 'https://example.com',
      embedded: true,
      app_preferences: {url: 'https://example.com/preferences'},
    })
  })

  test('app_access extracts only its own keys', () => {
    const result = appAccessModule.extract(fullConfig)
    expect(result).toEqual({
      access: {admin: {direct_api_mode: 'online'}},
      access_scopes: {scopes: 'read_products'},
      auth: {redirect_urls: ['https://example.com/callback']},
    })
  })

  test('webhooks extracts the full webhooks section', () => {
    const result = webhooksModule.extract(fullConfig)
    expect(result).toHaveProperty('webhooks')
    expect((result as any).webhooks.api_version).toBe('2024-01')
  })

  test('webhook_subscription splits into per-topic items', () => {
    const result = webhookSubscriptionModule.extract(fullConfig)
    // Only 1 non-compliance subscription with 1 topic
    expect(result).toHaveLength(1)
    expect(result![0]!.topic).toBe('orders/create')
  })

  test('privacy_compliance extracts when compliance_topics present', () => {
    const result = privacyComplianceWebhooksModule.extract(fullConfig)
    expect(result).toBeDefined()
    expect((result as any).webhooks.subscriptions).toBeDefined()
  })

  test('app_proxy (absolute URL)', async () => {
    const result = appProxyModule.extract(fullConfig)
    expect(result).toEqual({app_proxy: {url: 'https://proxy.com', subpath: 'apps', prefix: 'a'}})
  })

  test('events extracts only events key', () => {
    const result = eventsModule.extract(fullConfig)
    expect(result).toEqual({
      events: {api_version: '2024-01', subscription: [{topic: 'products/update', uri: 'https://example.com/events'}]},
    })
  })

  test('modules return undefined when their keys are absent', () => {
    const emptyConfig = {client_id: '123'}
    expect(brandingModule.extract(emptyConfig)).toBeUndefined()
    expect(pointOfSaleModule.extract(emptyConfig)).toBeUndefined()
    expect(appHomeModule.extract(emptyConfig)).toBeUndefined()
    expect(appAccessModule.extract(emptyConfig)).toBeUndefined()
    expect(webhooksModule.extract(emptyConfig)).toBeUndefined()
    expect(webhookSubscriptionModule.extract(emptyConfig)).toBeUndefined()
    expect(privacyComplianceWebhooksModule.extract(emptyConfig)).toBeUndefined()
    expect(appProxyModule.extract(emptyConfig)).toBeUndefined()
    expect(eventsModule.extract(emptyConfig)).toBeUndefined()
  })
})

// ============================================================================
// Criterion 3: encode() matches existing transformLocalToRemote
// ============================================================================

describe('encode matches existing transformLocalToRemote', () => {
  test('branding', async () => {
    const toml = {name: 'my-app', handle: 'my-app-handle'}
    const encoded = await brandingModule.encode(toml, encodeCtx)
    const existing = brandingSpec.transformLocalToRemote!(toml, placeholderAppConfiguration)
    expect(encoded).toEqual(existing)
  })

  test('point_of_sale', async () => {
    const toml = {pos: {embedded: true}}
    const encoded = await pointOfSaleModule.encode(toml, encodeCtx)
    const existing = posSpec.transformLocalToRemote!(toml, placeholderAppConfiguration)
    expect(encoded).toEqual(existing)
  })

  test('app_home', async () => {
    const toml = {
      application_url: 'https://example.com',
      embedded: true,
      app_preferences: {url: 'https://example.com/prefs'},
    }
    const encoded = await appHomeModule.encode(toml, encodeCtx)
    const existing = appHomeSpec.transformLocalToRemote!(toml, placeholderAppConfiguration)
    expect(encoded).toEqual(existing)
  })

  test('app_access', async () => {
    const toml = {
      access: {admin: {direct_api_mode: 'online' as const}},
      access_scopes: {
        scopes: 'read_products,write_products',
        optional_scopes: ['read_customers'],
        required_scopes: ['write_orders', 'read_inventory'],
        use_legacy_install_flow: true,
      },
      auth: {redirect_urls: ['https://example.com/auth/callback']},
    }
    const encoded = await appAccessModule.encode(toml, encodeCtx)
    const existing = appAccessSpec.transformLocalToRemote!(toml, placeholderAppConfiguration)
    expect(encoded).toEqual(existing)
  })

  test('webhooks', async () => {
    const toml = {
      webhooks: {
        api_version: '2024-01',
        subscriptions: [{topics: ['orders/create'], uri: 'https://example.com'}],
      },
    }
    const encoded = await webhooksModule.encode(toml, encodeCtx)
    const existing = webhooksSpec.transformLocalToRemote!(toml, placeholderAppConfiguration)
    expect(encoded).toEqual(existing)
  })

  test('app_proxy (absolute URL)', async () => {
    const toml = {app_proxy: {url: 'https://proxy.com', subpath: 'apps', prefix: 'a'}}
    const encoded = await appProxyModule.encode(toml, encodeCtx)
    const existing = appProxySpec.transformLocalToRemote!(toml, placeholderAppConfiguration)
    expect(encoded).toEqual(existing)
  })

  test('events (identity)', async () => {
    const toml = {
      events: {
        api_version: '2024-01',
        subscription: [{topic: 'orders/create', uri: 'https://example.com'}],
      },
    }
    const encoded = await eventsModule.encode(toml, encodeCtx)
    const existing = eventsSpec.transformLocalToRemote!(toml, placeholderAppConfiguration)
    expect(encoded).toEqual(existing)
  })

  test('privacy_compliance', async () => {
    const toml = {
      webhooks: {
        api_version: '2024-01',
        subscriptions: [
          {compliance_topics: ['customers/redact'], uri: 'https://example.com/redact'},
          {compliance_topics: ['customers/data_request'], uri: 'https://example.com/data'},
          {compliance_topics: ['shop/redact'], uri: 'https://example.com/shop'},
        ],
      },
    }
    const encoded = await privacyComplianceWebhooksModule.encode(toml, encodeCtx)
    const existing = privacyComplianceSpec.transformLocalToRemote!(toml, placeholderAppConfiguration)
    expect(encoded).toEqual(existing)
  })
})

// ============================================================================
// Criterion 4: decode() matches existing transformRemoteToLocal
// ============================================================================

describe('decode matches existing transformRemoteToLocal', () => {
  test('branding', async () => {
    const contract = {name: 'my-app', app_handle: 'my-app-handle'}
    const decoded = brandingModule.decode(contract)
    const existing = brandingSpec.transformRemoteToLocal!(contract)
    expect(decoded).toEqual(existing)
  })

  test('point_of_sale', async () => {
    const contract = {embedded: true}
    const decoded = pointOfSaleModule.decode(contract)
    const existing = posSpec.transformRemoteToLocal!(contract)
    expect(decoded).toEqual(existing)
  })

  test('app_home', async () => {
    const contract = {app_url: 'https://example.com', embedded: true, preferences_url: 'https://example.com/prefs'}
    const decoded = appHomeModule.decode(contract)
    const existing = appHomeSpec.transformRemoteToLocal!(contract)
    expect(decoded).toEqual(existing)
  })

  test('app_access', async () => {
    const contract = {
      access: {admin: {direct_api_mode: 'offline'}},
      scopes: 'read_products,write_products',
      optional_scopes: ['read_customers'],
      required_scopes: ['write_orders', 'read_inventory'],
      use_legacy_install_flow: true,
      redirect_url_allowlist: ['https://example.com/auth/callback'],
    }
    const decoded = appAccessModule.decode(contract)
    const existing = appAccessSpec.transformRemoteToLocal!(contract)
    expect(decoded).toEqual(existing)
  })

  test('webhooks', async () => {
    const contract = {api_version: '2024-01'}
    const decoded = webhooksModule.decode(contract)
    const existing = webhooksSpec.transformRemoteToLocal!(contract)
    expect(decoded).toEqual(existing)
  })

  test('app_proxy (absolute URL)', async () => {
    const contract = {url: 'https://proxy.com', subpath: 'apps', prefix: 'a'}
    const decoded = appProxyModule.decode(contract)
    const existing = appProxySpec.transformRemoteToLocal!(contract)
    expect(decoded).toEqual(existing)
  })

  test('events (strips identifier)', async () => {
    const contract = {
      events: {
        api_version: '2024-01',
        subscription: [
          {topic: 'orders/create', uri: 'https://example.com', identifier: 'id-1'},
          {topic: 'products/update', uri: 'https://example.com', identifier: 'id-2'},
        ],
      },
    }
    const decoded = eventsModule.decode(contract)
    const existing = eventsSpec.transformRemoteToLocal!(contract)
    expect(decoded).toEqual(existing)
  })

  test('privacy_compliance', async () => {
    const contract = {
      api_version: '2024-01',
      customers_redact_url: 'https://example.com/redact',
      customers_data_request_url: 'https://example.com/data',
      shop_redact_url: 'https://example.com/shop',
    }
    const decoded = privacyComplianceWebhooksModule.decode(contract)
    const existing = privacyComplianceSpec.transformRemoteToLocal!(contract)
    expect(decoded).toEqual(existing)
  })
})

// ============================================================================
// Criterion 5-7: AppToml orchestration
// ============================================================================

describe('AppToml orchestration', () => {
  test('toDeployPayloads produces payloads for all present modules', async () => {
    const fullConfig = {
      name: 'my-app',
      handle: 'my-handle',
      pos: {embedded: true},
      events: {api_version: '2024-01', subscription: [{topic: 'orders/create', uri: 'https://e.com'}]},
    }

    const appToml = new AppToml(fullConfig, [brandingModule, pointOfSaleModule, eventsModule])
    const payloads = await appToml.toDeployPayloads(encodeCtx)

    expect(payloads).toHaveLength(3)
    expect(payloads.map((payload) => payload.identifier).sort()).toEqual(['branding', 'events', 'point_of_sale'])
  })

  test('toDeployPayloads skips modules not present in TOML', async () => {
    const fullConfig = {name: 'my-app', handle: 'my-handle'}
    const appToml = new AppToml(fullConfig, [brandingModule, pointOfSaleModule])
    const payloads = await appToml.toDeployPayloads(encodeCtx)

    // Only branding is present (has 'name' and 'handle' keys).
    // point_of_sale is absent (no 'pos' key).
    expect(payloads).toHaveLength(1)
    expect(payloads[0]!.identifier).toBe('branding')
    expect(payloads[0]!.config).toEqual({name: 'my-app', app_handle: 'my-handle'})
  })

  test('getKeyOwnership shows shared webhooks key', () => {
    const appToml = new AppToml({}, allAppModules)
    const ownership = appToml.getKeyOwnership()

    const webhooksOwners = ownership.get('webhooks')!
    expect(webhooksOwners).toContain('webhooks')
    expect(webhooksOwners).toContain('webhook_subscription')
    expect(webhooksOwners).toContain('privacy_compliance_webhooks')
    expect(webhooksOwners).toHaveLength(3)
  })

  test('fromServerModules reconstructs TOML from server data', () => {
    const serverModules = [
      {identifier: 'branding', config: {name: 'my-app', app_handle: 'my-handle'}},
      {identifier: 'point_of_sale', config: {embedded: true}},
    ]

    const toml = AppToml.fromServerModules(serverModules, [brandingModule, pointOfSaleModule])
    expect(toml.name).toBe('my-app')
    expect(toml.handle).toBe('my-handle')
    expect((toml.pos as any).embedded).toBe(true)
  })
})
