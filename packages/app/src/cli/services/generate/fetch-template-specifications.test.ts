import {fetchExtensionTemplates} from './fetch-template-specifications.js'
import {testRemoteExtensionTemplates} from '../../models/app/app.test-data.js'
import {ExtensionTemplate} from '../../models/app/template.js'
import productSubscriptionUIExtension from '../../models/templates/ui-specifications/product_subscription.js'
import {describe, vi, expect, test} from 'vitest'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'

vi.mock('@shopify/cli-kit/node/api/partners')

describe('fetchTemplateSpecifications', () => {
  test('returns the remote and local specs', async () => {
    // Given
    vi.mocked(partnersRequest).mockResolvedValue({templateSpecifications: testRemoteExtensionTemplates})
    const enabledSpecifications = ['subscription_ui', 'theme', 'function']

    // When
    const got: ExtensionTemplate[] = await fetchExtensionTemplates('token', 'apiKey', enabledSpecifications)

    // Then
    expect(got.length).toEqual(6)
    const identifiers = got.map((spec) => spec.identifier)
    expect(identifiers).toContain('cart_checkout_validation')
    expect(identifiers).toContain('cart_transform')
    expect(identifiers).toContain('product_discounts')
    expect(identifiers).toContain('order_discounts')
    expect(identifiers).toContain('theme_app_extension')
    expect(identifiers).toContain('subscription_ui')

    // Since the ui_extension specification is not enabled, this template should not be included.
    expect(identifiers).not.toContain('ui_extension')
  })

  test('filters out local specs that already exist in remote', async () => {
    // Given
    const remoteTemplates = [...testRemoteExtensionTemplates, productSubscriptionUIExtension]
    vi.mocked(partnersRequest).mockResolvedValue({templateSpecifications: remoteTemplates})
    const enabledSpecifications = ['subscription_ui', 'theme', 'function']

    // When
    const got: ExtensionTemplate[] = await fetchExtensionTemplates('token', 'apiKey', enabledSpecifications)

    // Then
    expect(got.length).toEqual(6)
    const identifiers = got.map((spec) => spec.identifier)
    expect(identifiers).toContain('cart_checkout_validation')
    expect(identifiers).toContain('cart_transform')
    expect(identifiers).toContain('product_discounts')
    expect(identifiers).toContain('order_discounts')
    expect(identifiers).toContain('theme_app_extension')
    expect(identifiers).toContain('subscription_ui')

    // checkout is both local and remote, but only 1 should be included
    expect(identifiers.filter((id) => id === 'subscription_ui')?.length).toEqual(1)

    // Since the ui_extension specification is not enabled, this template should not be included.
    expect(identifiers).not.toContain('ui_extension')
  })
})
