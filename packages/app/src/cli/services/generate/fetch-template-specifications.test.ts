import {fetchExtensionTemplates} from './fetch-template-specifications.js'
import {testRemoteExtensionTemplates} from '../../models/app/app.test-data.js'
import {ExtensionTemplate} from '../../models/app/template.js'
import {describe, vi, expect, test} from 'vitest'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'

vi.mock('@shopify/cli-kit/node/api/partners')

describe('fetchTemplateSpecifications', () => {
  test('returns the remote and local specs', async () => {
    // Given
    vi.mocked(partnersRequest).mockResolvedValue({templateSpecifications: testRemoteExtensionTemplates})

    // When
    const got: ExtensionTemplate[] = await fetchExtensionTemplates('token')

    // Then
    expect(got.length).toEqual(13)
    const identifiers = got.map((spec) => spec.identifier)
    expect(identifiers).toContain('cart_checkout_validation')
    expect(identifiers).toContain('cart_transform')
    expect(identifiers).toContain('product_discounts')
    expect(identifiers).toContain('order_discounts')
    expect(identifiers).toContain('theme_app_extension')
    expect(identifiers).toContain('post_purchase_ui')
    expect(identifiers).toContain('checkout_ui')
    expect(identifiers).toContain('customer_accounts_ui_extension')
    expect(identifiers).toContain('pos_ui')
    expect(identifiers).toContain('subscription_ui')
    expect(identifiers).toContain('tax_calculation')
    expect(identifiers).toContain('ui_extension')
    expect(identifiers).toContain('web_pixel')
  })
})
