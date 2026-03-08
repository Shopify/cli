import brandingSpec from '../app_config_branding.js'
import appHomeSpec from '../app_config_app_home.js'
import appAccessSpec from '../app_config_app_access.js'
import posSpec from '../app_config_point_of_sale.js'
import appProxySpec from '../app_config_app_proxy.js'
import webhookSpec from '../app_config_webhook.js'
import webhookSubscriptionSpec from '../app_config_webhook_subscription.js'
import privacyComplianceSpec from '../app_config_privacy_compliance_webhooks.js'
import eventsSpec from '../app_config_events.js'
import {AppConfiguration} from '../../../app/app.js'
import {describe, expect, test} from 'vitest'

/**
 * Round-trip fidelity tests for all 9 config extension specs.
 *
 * For each spec, we test: reverse(forward(localInput, appConfig)) and compare to localInput.
 * Specs with TransformationConfig (path-based bijection) should round-trip exactly.
 * Specs with CustomTransformationConfig may have known asymmetries (documented inline).
 */

const appConfigWithUrl = {
  application_url: 'https://example.com',
} as unknown as AppConfiguration

const appConfigPlain = {scopes: ''} as unknown as AppConfiguration

function roundTrip(
  spec: {
    transformLocalToRemote?: (content: object, appConfig: AppConfiguration) => object
    transformRemoteToLocal?: (content: object) => object
  },
  localInput: object,
  appConfig: AppConfiguration = appConfigPlain,
) {
  const remote = spec.transformLocalToRemote!(localInput, appConfig)
  return spec.transformRemoteToLocal!(remote)
}

describe('spec transform round-trips', () => {
  // --- Path-based bijection specs (should round-trip exactly) ---

  describe('branding', () => {
    test('round-trips exactly', () => {
      const local = {name: 'my-app', handle: 'my-handle'}
      expect(roundTrip(brandingSpec, local)).toEqual(local)
    })

    test('round-trips with partial fields', () => {
      const local = {name: 'my-app'}
      expect(roundTrip(brandingSpec, local)).toEqual(local)
    })
  })

  describe('app_home', () => {
    test('round-trips exactly', () => {
      const local = {
        application_url: 'https://example.com',
        embedded: true,
        app_preferences: {url: 'https://example.com/prefs'},
      }
      expect(roundTrip(appHomeSpec, local)).toEqual(local)
    })

    test('round-trips without optional preferences', () => {
      const local = {application_url: 'https://example.com', embedded: false}
      expect(roundTrip(appHomeSpec, local)).toEqual(local)
    })
  })

  describe('app_access', () => {
    test('round-trips exactly', () => {
      const local = {
        access: {admin: {direct_api_mode: 'online', embedded_app_direct_api_access: true}},
        access_scopes: {scopes: 'read_products,write_products', use_legacy_install_flow: false},
        auth: {redirect_urls: ['https://example.com/callback']},
      }
      expect(roundTrip(appAccessSpec, local)).toEqual(local)
    })

    test('round-trips with minimal fields', () => {
      const local = {auth: {redirect_urls: ['https://example.com/callback']}}
      expect(roundTrip(appAccessSpec, local)).toEqual(local)
    })
  })

  describe('point_of_sale', () => {
    test('round-trips exactly', () => {
      const local = {pos: {embedded: true}}
      expect(roundTrip(posSpec, local)).toEqual(local)
    })

    test('round-trips when pos is absent', () => {
      const local = {}
      expect(roundTrip(posSpec, local)).toEqual(local)
    })
  })

  // --- Custom transform specs (known asymmetries documented) ---

  describe('app_proxy', () => {
    test('round-trips with absolute URL', () => {
      const local = {app_proxy: {url: 'https://proxy.example.com/path', subpath: 'apps', prefix: 'my-app'}}
      expect(roundTrip(appProxySpec, local, appConfigWithUrl)).toEqual(local)
    })

    test('relative URL becomes absolute after round-trip', () => {
      // Asymmetry: forward prepends application_url to relative URLs, reverse does not strip it back
      const local = {app_proxy: {url: '/proxy', subpath: 'apps', prefix: 'my-app'}}
      const result = roundTrip(appProxySpec, local, appConfigWithUrl)

      expect(result).toEqual({
        app_proxy: {url: 'https://example.com/proxy', subpath: 'apps', prefix: 'my-app'},
      })
    })

    test('empty config produces empty forward, reverse wraps in app_proxy', () => {
      const remote = appProxySpec.transformLocalToRemote!({}, appConfigWithUrl)
      expect(remote).toEqual({})

      const reversed = appProxySpec.transformRemoteToLocal!(remote)
      // Reverse always wraps in app_proxy, even with undefined fields
      expect(reversed).toEqual({
        app_proxy: {url: undefined, subpath: undefined, prefix: undefined},
      })
    })
  })

  describe('webhooks', () => {
    test('round-trips api_version', () => {
      // Asymmetry: forward extracts only api_version, subscriptions are intentionally dropped
      // (handled by webhook_subscription spec)
      const local = {webhooks: {api_version: '2024-01'}}
      expect(roundTrip(webhookSpec, local)).toEqual(local)
    })

    test('subscriptions are dropped during round-trip', () => {
      const local = {
        webhooks: {
          api_version: '2024-01',
          subscriptions: [{topics: ['products/create'], uri: 'https://example.com/webhooks'}],
        },
      }
      const result = roundTrip(webhookSpec, local)
      // Only api_version survives — subscriptions handled by webhook_subscription spec
      expect(result).toEqual({webhooks: {api_version: '2024-01'}})
    })
  })

  describe('webhook_subscription', () => {
    test('single topic wraps into topics array', () => {
      // Asymmetry: forward produces {topic: 'x'} (single), reverse produces {topics: ['x']} (array)
      const local = {topics: ['products/create'], uri: 'https://example.com/webhooks'}
      const remote = webhookSubscriptionSpec.transformLocalToRemote!(local, appConfigPlain)

      // Forward just passes through (no relative URL to resolve)
      expect(remote).toEqual({topics: ['products/create'], uri: 'https://example.com/webhooks'})

      // Reverse wraps in webhooks.subscriptions structure with topic → topics
      const reversed = webhookSubscriptionSpec.transformRemoteToLocal!(remote)
      expect(reversed).toEqual({
        webhooks: {
          subscriptions: [{topics: ['products/create'], uri: 'https://example.com/webhooks'}],
        },
      })
    })

    test('relative URI becomes absolute after forward', () => {
      const local = {topics: ['products/create'], uri: '/webhooks'}
      const remote = webhookSubscriptionSpec.transformLocalToRemote!(local, appConfigWithUrl)

      expect(remote).toEqual({topics: ['products/create'], uri: 'https://example.com/webhooks'})
    })
  })

  describe('privacy_compliance_webhooks', () => {
    test('round-trips compliance URLs', () => {
      const local = {
        webhooks: {
          api_version: '2024-01',
          subscriptions: [
            {compliance_topics: ['customers/data_request'], uri: 'https://example.com/data-request'},
            {compliance_topics: ['customers/redact'], uri: 'https://example.com/customers-redact'},
            {compliance_topics: ['shop/redact'], uri: 'https://example.com/shop-redact'},
          ],
        },
      }

      const remote = privacyComplianceSpec.transformLocalToRemote!(local, appConfigPlain)
      expect(remote).toEqual({
        api_version: '2024-01',
        customers_data_request_url: 'https://example.com/data-request',
        customers_redact_url: 'https://example.com/customers-redact',
        shop_redact_url: 'https://example.com/shop-redact',
      })

      const reversed = privacyComplianceSpec.transformRemoteToLocal!(remote)
      // Reverse reconstructs subscriptions from flat URLs, sorted by URI
      expect(reversed).toEqual({
        webhooks: {
          subscriptions: [
            {compliance_topics: ['customers/redact'], uri: 'https://example.com/customers-redact'},
            {compliance_topics: ['customers/data_request'], uri: 'https://example.com/data-request'},
            {compliance_topics: ['shop/redact'], uri: 'https://example.com/shop-redact'},
          ],
          privacy_compliance: undefined,
        },
      })
    })

    test('relative URIs become absolute after forward', () => {
      const local = {
        webhooks: {
          api_version: '2024-01',
          subscriptions: [{compliance_topics: ['customers/redact'], uri: '/customers-redact'}],
        },
      }
      const remote = privacyComplianceSpec.transformLocalToRemote!(local, appConfigWithUrl)
      expect(remote).toEqual({
        api_version: '2024-01',
        customers_redact_url: 'https://example.com/customers-redact',
      })
    })

    test('empty webhooks produce empty result', () => {
      const local = {webhooks: {api_version: '2024-01', subscriptions: []}}
      const remote = privacyComplianceSpec.transformLocalToRemote!(local, appConfigPlain)
      // No compliance URLs → empty object
      expect(remote).toEqual({})
    })
  })

  describe('events', () => {
    test('round-trips with absolute URIs (identifier stripped)', () => {
      // Asymmetry: reverse strips server-managed `identifier` field
      const local = {events: {api_version: '2024-01', subscription: [{uri: 'https://example.com/events'}]}}

      const remote = eventsSpec.transformLocalToRemote!(local, appConfigPlain)
      expect(remote).toEqual(local)

      // Simulate server adding identifier
      const remoteWithIdentifier = {
        events: {
          api_version: '2024-01',
          subscription: [{uri: 'https://example.com/events', identifier: 'evt_123'}],
        },
      }
      const reversed = eventsSpec.transformRemoteToLocal!(remoteWithIdentifier)
      // identifier is stripped
      expect(reversed).toEqual({events: {api_version: '2024-01', subscription: [{uri: 'https://example.com/events'}]}})
    })

    test('relative URI becomes absolute after forward', () => {
      const local = {events: {api_version: '2024-01', subscription: [{uri: '/events'}]}}
      const remote = eventsSpec.transformLocalToRemote!(local, appConfigWithUrl)
      expect(remote).toEqual({
        events: {api_version: '2024-01', subscription: [{uri: 'https://example.com/events'}]},
      })
    })

    test('round-trips without subscriptions', () => {
      const local = {events: {api_version: '2024-01'}}
      expect(roundTrip(eventsSpec, local)).toEqual(local)
    })
  })
})
