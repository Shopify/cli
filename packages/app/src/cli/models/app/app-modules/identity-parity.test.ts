/**
 * Identity computation parity tests.
 *
 * Proves that the identity logic intended for AppModule.computeHandle() and
 * AppModule.computeUid() produces identical results to the existing
 * ExtensionInstance.buildHandle() and ExtensionInstance.buildUIDFromStrategy()
 * for every UID strategy (single, uuid, dynamic).
 *
 * ExtensionInstance stores the computed handle and uid as public properties set
 * in its constructor, so we compare against those directly.
 */

import {brandingModule} from './branding.js'
import {uiExtensionModule} from './ui-extension.js'
import {webhookSubscriptionModule} from './webhook-subscription.js'
import {AppModule} from '../app-module.js'
import {ExtensionInstance} from '../../extensions/extension-instance.js'
import {loadLocalExtensionsSpecifications} from '../../extensions/load-specifications.js'
import {MAX_EXTENSION_HANDLE_LENGTH, MAX_UID_LENGTH} from '../../extensions/schemas.js'
import {SingleWebhookSubscriptionType} from '../../extensions/specifications/app_config_webhook_schemas/webhooks_schema.js'
import appWebhookSubscriptionSpec from '../../extensions/specifications/app_config_webhook_subscription.js'
import {BaseConfigType} from '../../extensions/schemas.js'
import {ExtensionSpecification} from '../../extensions/specification.js'
import {hashString, nonRandomUUID} from '@shopify/cli-kit/node/crypto'
import {slugify} from '@shopify/cli-kit/common/string'
import {describe, test, expect} from 'vitest'

/**
 * Proposed AppModule identity computation — mirrors ExtensionInstance.buildHandle().
 * This is the logic that AppModule.computeHandle() should implement.
 */
function computeHandle(
  module: {identifier: string; uidStrategy: 'single' | 'dynamic' | 'uuid'},
  config: Record<string, unknown>,
): string {
  switch (module.uidStrategy) {
    case 'single':
      return module.identifier
    case 'uuid':
      return (config.handle as string) ?? slugify((config.name as string) ?? '')
    case 'dynamic':
      // Hardcoded temporal solution for webhooks (matches ExtensionInstance)
      if ('topic' in config && 'uri' in config) {
        const subscription = config as unknown as SingleWebhookSubscriptionType
        const handle = `${subscription.topic}${subscription.uri}${subscription.filter}`
        return hashString(handle).substring(0, MAX_EXTENSION_HANDLE_LENGTH)
      } else {
        return nonRandomUUID(JSON.stringify(config))
      }
  }
}

/**
 * Proposed AppModule identity computation — mirrors ExtensionInstance.buildUIDFromStrategy().
 * This is the logic that AppModule.computeUid() should implement.
 */
function computeUid(
  module: {identifier: string; uidStrategy: 'single' | 'dynamic' | 'uuid'},
  config: Record<string, unknown>,
  handle: string,
): string {
  switch (module.uidStrategy) {
    case 'single':
      return module.identifier
    case 'uuid':
      return (config.uid as string) ?? nonRandomUUID(handle)
    case 'dynamic':
      if ('topic' in config && 'uri' in config) {
        const subscription = config as unknown as SingleWebhookSubscriptionType
        return `${subscription.topic}::${subscription.filter}::${subscription.uri}`.substring(0, MAX_UID_LENGTH)
      } else {
        return nonRandomUUID(JSON.stringify(config))
      }
  }
}

// ============================================================================
// uidStrategy: 'single' — branding
// ============================================================================

describe('Identity parity: uidStrategy single', () => {
  test('handle and uid both equal the spec identifier', async () => {
    // --- Old system (ExtensionInstance) ---
    const allSpecs = await loadLocalExtensionsSpecifications()
    const brandingSpec = allSpecs.find((spec) => spec.identifier === 'branding')!

    const config = {
      name: 'My App',
    } as unknown as BaseConfigType

    const oldInstance = new ExtensionInstance({
      configuration: config,
      configurationPath: 'shopify.app.toml',
      directory: './',
      specification: brandingSpec,
    })

    // --- New system (AppModule-based computation) ---
    const newHandle = computeHandle(brandingModule, config as unknown as Record<string, unknown>)
    const newUid = computeUid(brandingModule, config as unknown as Record<string, unknown>, newHandle)

    // --- Parity assertions ---
    expect(newHandle).toBe(oldInstance.handle)
    expect(newUid).toBe(oldInstance.uid)

    // Both should be the identifier itself
    expect(newHandle).toBe('branding')
    expect(newUid).toBe('branding')
  })
})

// ============================================================================
// uidStrategy: 'uuid' — ui_extension with explicit handle
// ============================================================================

describe('Identity parity: uidStrategy uuid', () => {
  test('with explicit handle and no uid, uid is nonRandomUUID(handle)', async () => {
    const allSpecs = await loadLocalExtensionsSpecifications()
    const uiSpec = allSpecs.find((spec) => spec.identifier === 'ui_extension')!

    const config = {
      name: 'My Extension',
      type: 'ui_extension',
      handle: 'my-ext',
    } as unknown as BaseConfigType

    // --- Old system ---
    const oldInstance = new ExtensionInstance({
      configuration: config,
      configurationPath: '/tmp/project/extensions/my-ext/shopify.ui.extension.toml',
      directory: '/tmp/project/extensions/my-ext',
      specification: uiSpec,
    })

    // --- New system ---
    const newHandle = computeHandle(uiExtensionModule, config as unknown as Record<string, unknown>)
    const newUid = computeUid(uiExtensionModule, config as unknown as Record<string, unknown>, newHandle)

    // --- Parity ---
    expect(newHandle).toBe(oldInstance.handle)
    expect(newUid).toBe(oldInstance.uid)

    // Verify expected values
    expect(newHandle).toBe('my-ext')
    expect(newUid).toBe(nonRandomUUID('my-ext'))
  })

  test('with explicit handle and explicit uid, uid comes from config', async () => {
    const allSpecs = await loadLocalExtensionsSpecifications()
    const uiSpec = allSpecs.find((spec) => spec.identifier === 'ui_extension')!

    const config = {
      name: 'My Extension',
      type: 'ui_extension',
      handle: 'my-ext',
      uid: 'custom-uid',
    } as unknown as BaseConfigType

    // --- Old system ---
    const oldInstance = new ExtensionInstance({
      configuration: config,
      configurationPath: '/tmp/project/extensions/my-ext/shopify.ui.extension.toml',
      directory: '/tmp/project/extensions/my-ext',
      specification: uiSpec,
    })

    // --- New system ---
    const newHandle = computeHandle(uiExtensionModule, config as unknown as Record<string, unknown>)
    const newUid = computeUid(uiExtensionModule, config as unknown as Record<string, unknown>, newHandle)

    // --- Parity ---
    expect(newHandle).toBe(oldInstance.handle)
    expect(newUid).toBe(oldInstance.uid)

    // Verify expected values
    expect(newHandle).toBe('my-ext')
    expect(newUid).toBe('custom-uid')
  })

  test('with no handle, handle is slugified name and uid is nonRandomUUID(slugified name)', async () => {
    const allSpecs = await loadLocalExtensionsSpecifications()
    const uiSpec = allSpecs.find((spec) => spec.identifier === 'ui_extension')!

    const config = {
      name: 'My Extension',
      type: 'ui_extension',
    } as unknown as BaseConfigType

    // --- Old system ---
    const oldInstance = new ExtensionInstance({
      configuration: config,
      configurationPath: '/tmp/project/extensions/my-ext/shopify.ui.extension.toml',
      directory: '/tmp/project/extensions/my-ext',
      specification: uiSpec,
    })

    // --- New system ---
    const newHandle = computeHandle(uiExtensionModule, config as unknown as Record<string, unknown>)
    const newUid = computeUid(uiExtensionModule, config as unknown as Record<string, unknown>, newHandle)

    // --- Parity ---
    expect(newHandle).toBe(oldInstance.handle)
    expect(newUid).toBe(oldInstance.uid)

    // Verify expected values
    expect(newHandle).toBe(slugify('My Extension'))
    expect(newUid).toBe(nonRandomUUID(slugify('My Extension')))
  })
})

// ============================================================================
// uidStrategy: 'dynamic' — webhook_subscription
// ============================================================================

describe('Identity parity: uidStrategy dynamic (webhook subscription)', () => {
  test('handle is hashString(topic+uri+filter), uid is topic::filter::uri', async () => {
    const config = {
      topic: 'orders/create',
      uri: 'https://example.com/webhook',
      filter: 'id:*',
      api_version: '2024-01',
    } as unknown as BaseConfigType

    // --- Old system ---
    const oldInstance = new ExtensionInstance({
      configuration: config,
      configurationPath: 'shopify.app.toml',
      directory: './',
      specification: appWebhookSubscriptionSpec as unknown as ExtensionSpecification,
    })

    // --- New system ---
    const newHandle = computeHandle(webhookSubscriptionModule, config as unknown as Record<string, unknown>)
    const newUid = computeUid(webhookSubscriptionModule, config as unknown as Record<string, unknown>, newHandle)

    // --- Parity ---
    expect(newHandle).toBe(oldInstance.handle)
    expect(newUid).toBe(oldInstance.uid)

    // Verify expected intermediate values
    const expectedHandle = hashString('orders/createhttps://example.com/webhookid:*').substring(
      0,
      MAX_EXTENSION_HANDLE_LENGTH,
    )
    expect(newHandle).toBe(expectedHandle)
    expect(newUid).toBe('orders/create::id:*::https://example.com/webhook')
  })

  test('handle and uid with undefined filter', async () => {
    const config = {
      topic: 'orders/delete',
      uri: 'https://my-app.com/webhooks',
      api_version: '2024-01',
    } as unknown as BaseConfigType

    // --- Old system ---
    const oldInstance = new ExtensionInstance({
      configuration: config,
      configurationPath: 'shopify.app.toml',
      directory: './',
      specification: appWebhookSubscriptionSpec as unknown as ExtensionSpecification,
    })

    // --- New system ---
    const newHandle = computeHandle(webhookSubscriptionModule, config as unknown as Record<string, unknown>)
    const newUid = computeUid(webhookSubscriptionModule, config as unknown as Record<string, unknown>, newHandle)

    // --- Parity ---
    expect(newHandle).toBe(oldInstance.handle)
    expect(newUid).toBe(oldInstance.uid)

    // The uid should contain 'undefined' as the filter value since filter is not set
    expect(newUid).toBe('orders/delete::undefined::https://my-app.com/webhooks')
  })

  test('handle and uid with explicit filter', async () => {
    const config = {
      topic: 'orders/delete',
      uri: 'https://my-app.com/webhooks',
      filter: '123',
      api_version: '2024-01',
    } as unknown as BaseConfigType

    // --- Old system ---
    const oldInstance = new ExtensionInstance({
      configuration: config,
      configurationPath: 'shopify.app.toml',
      directory: './',
      specification: appWebhookSubscriptionSpec as unknown as ExtensionSpecification,
    })

    // --- New system ---
    const newHandle = computeHandle(webhookSubscriptionModule, config as unknown as Record<string, unknown>)
    const newUid = computeUid(webhookSubscriptionModule, config as unknown as Record<string, unknown>, newHandle)

    // --- Parity ---
    expect(newHandle).toBe(oldInstance.handle)
    expect(newUid).toBe(oldInstance.uid)

    expect(newUid).toBe('orders/delete::123::https://my-app.com/webhooks')
  })

  test('handle is truncated to MAX_EXTENSION_HANDLE_LENGTH, uid to MAX_UID_LENGTH', async () => {
    // Use a long topic/uri/filter to test truncation behavior
    const longTopic = 'a'.repeat(100)
    const longUri = 'https://example.com/' + 'b'.repeat(100)
    const longFilter = 'c'.repeat(100)

    const config = {
      topic: longTopic,
      uri: longUri,
      filter: longFilter,
      api_version: '2024-01',
    } as unknown as BaseConfigType

    // --- Old system ---
    const oldInstance = new ExtensionInstance({
      configuration: config,
      configurationPath: 'shopify.app.toml',
      directory: './',
      specification: appWebhookSubscriptionSpec as unknown as ExtensionSpecification,
    })

    // --- New system ---
    const newHandle = computeHandle(webhookSubscriptionModule, config as unknown as Record<string, unknown>)
    const newUid = computeUid(webhookSubscriptionModule, config as unknown as Record<string, unknown>, newHandle)

    // --- Parity ---
    expect(newHandle).toBe(oldInstance.handle)
    expect(newUid).toBe(oldInstance.uid)

    // Handle is a hash truncated to MAX_EXTENSION_HANDLE_LENGTH
    expect(newHandle.length).toBeLessThanOrEqual(MAX_EXTENSION_HANDLE_LENGTH)
    // UID is the raw string truncated to MAX_UID_LENGTH
    expect(newUid.length).toBeLessThanOrEqual(MAX_UID_LENGTH)
  })
})

// ============================================================================
// uidStrategy: 'dynamic' — non-webhook (generic dynamic)
// ============================================================================

describe('Identity parity: uidStrategy dynamic (non-webhook fallback)', () => {
  test('both handle and uid are nonRandomUUID(JSON.stringify(config)) for non-webhook dynamic config', async () => {
    // Create a fake spec that has dynamic strategy but no topic/uri
    const allSpecs = await loadLocalExtensionsSpecifications()
    const webhookSubSpec = allSpecs.find((spec) => spec.identifier === 'webhook_subscription')!

    // Config without topic/uri triggers the else branch
    const config = {
      some_field: 'value',
      another: 42,
    } as unknown as BaseConfigType

    // --- Old system ---
    const oldInstance = new ExtensionInstance({
      configuration: config,
      configurationPath: 'shopify.app.toml',
      directory: './',
      specification: webhookSubSpec,
    })

    // --- New system ---
    // Use a module with dynamic strategy
    const dynamicModule = {identifier: 'webhook_subscription', uidStrategy: 'dynamic' as const}
    const newHandle = computeHandle(dynamicModule, config as unknown as Record<string, unknown>)
    const newUid = computeUid(dynamicModule, config as unknown as Record<string, unknown>, newHandle)

    // --- Parity ---
    expect(newHandle).toBe(oldInstance.handle)
    expect(newUid).toBe(oldInstance.uid)

    // Both should be nonRandomUUID of the JSON config
    const expectedUUID = nonRandomUUID(JSON.stringify(config))
    expect(newHandle).toBe(expectedUUID)
    expect(newUid).toBe(expectedUUID)
  })
})
