import brandingSpec from '../app_config_branding.js'
import appHomeSpec from '../app_config_app_home.js'
import appAccessSpec from '../app_config_app_access.js'
import posSpec from '../app_config_point_of_sale.js'
import appProxySpec from '../app_config_app_proxy.js'
import webhookSpec from '../app_config_webhook.js'
import webhookSubscriptionSpec from '../app_config_webhook_subscription.js'
import privacyComplianceSpec from '../app_config_privacy_compliance_webhooks.js'
import eventsSpec from '../app_config_events.js'
import {describe, expect, test} from 'vitest'

/**
 * Tests that declaredKeys is computed correctly for all 9 config extension specs.
 * These keys are used by sliceConfigForSpec() to extract each spec's portion
 * of the raw app config without running a parse.
 */
describe('declaredKeys', () => {
  // All specs that extend BaseSchemaWithoutHandle inherit these base keys.
  // They're included in declaredKeys (unfiltered) — pick() intersects with
  // what's actually in the raw config.
  const baseKeys = ['name', 'type', 'uid', 'description', 'api_version', 'extension_points', 'capabilities', 'supported_features', 'settings']

  test('branding declares base keys + handle', () => {
    expect(brandingSpec.declaredKeys).toEqual(expect.arrayContaining([...baseKeys, 'handle']))
    // name is overridden (required vs optional) but still present
    expect(brandingSpec.declaredKeys).toContain('name')
  })

  test('app_home declares base keys + application_url, embedded, app_preferences', () => {
    expect(appHomeSpec.declaredKeys).toEqual(expect.arrayContaining([
      ...baseKeys, 'application_url', 'embedded', 'app_preferences',
    ]))
  })

  test('app_access declares base keys + access, access_scopes, auth', () => {
    expect(appAccessSpec.declaredKeys).toEqual(expect.arrayContaining([
      ...baseKeys, 'access', 'access_scopes', 'auth',
    ]))
  })

  test('point_of_sale declares base keys + pos', () => {
    expect(posSpec.declaredKeys).toEqual(expect.arrayContaining([...baseKeys, 'pos']))
  })

  test('app_proxy declares base keys + app_proxy', () => {
    expect(appProxySpec.declaredKeys).toEqual(expect.arrayContaining([...baseKeys, 'app_proxy']))
  })

  test('webhooks declares base keys + webhooks', () => {
    expect(webhookSpec.declaredKeys).toEqual(expect.arrayContaining([...baseKeys, 'webhooks']))
  })

  test('privacy_compliance_webhooks declares base keys + webhooks', () => {
    expect(privacyComplianceSpec.declaredKeys).toEqual(expect.arrayContaining([...baseKeys, 'webhooks']))
  })

  test('events declares base keys + events', () => {
    expect(eventsSpec.declaredKeys).toEqual(expect.arrayContaining([...baseKeys, 'events']))
  })

  test('webhook_subscription declares its own keys (no base keys — plain zod.object)', () => {
    // SingleWebhookSubscriptionSchema is a plain zod.object, not extending BaseSchemaWithoutHandle
    expect(webhookSubscriptionSpec.declaredKeys).toEqual(expect.arrayContaining([
      'topic', 'actions', 'api_version', 'uri', 'include_fields', 'filter', 'payload_query', 'name',
    ]))
    // Should NOT have base-only keys like 'type' or 'uid'
    expect(webhookSubscriptionSpec.declaredKeys).not.toContain('type')
    expect(webhookSubscriptionSpec.declaredKeys).not.toContain('uid')
  })

  test('all config specs have non-empty declaredKeys', () => {
    const allSpecs = [
      brandingSpec, appHomeSpec, appAccessSpec, posSpec, appProxySpec,
      webhookSpec, webhookSubscriptionSpec, privacyComplianceSpec, eventsSpec,
    ]
    for (const spec of allSpecs) {
      expect(spec.declaredKeys.length).toBeGreaterThan(0)
    }
  })
})
