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
    const enabledLocalTemplates = ['checkout_ui_extension', 'theme']

    // When
    const got: ExtensionTemplate[] = await fetchExtensionTemplates('token', 'apiKey', enabledLocalTemplates)

    // Then
    expect(got.length).toEqual(6)
    const identifiers = got.map((spec) => spec.identifier)
    expect(identifiers).toContain('cart_checkout_validation')
    expect(identifiers).toContain('cart_transform')
    expect(identifiers).toContain('product_discounts')
    expect(identifiers).toContain('order_discounts')
    expect(identifiers).toContain('theme_app_extension')
    expect(identifiers).toContain('checkout_ui')
  })
})
