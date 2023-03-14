import {fetchTemplateSpecifications} from './fetch-template-specifications.js'
import {testRemoteTemplateSpecifications} from '../../models/app/app.test-data.js'
import {BaseFunctionConfigurationSchema} from '../../models/extensions/schemas.js'
import {TemplateSpecification} from '../../models/app/template.js'
import {describe, it, vi, expect} from 'vitest'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'

vi.mock('@shopify/cli-kit/node/api/partners')

describe('fetchTemplateSpecifications', () => {
  it('returns the filtered and mapped results', async () => {
    // Given
    vi.mocked(partnersRequest).mockResolvedValue({templateSpecifications: testRemoteTemplateSpecifications})

    // When
    const got: TemplateSpecification[] = await fetchTemplateSpecifications('token')

    // Then
    expect(got).toEqual(
      expect.arrayContaining([
        {
          identifier: 'cart_checkout_validation',
          name: 'Function - Cart and Checkout Validation',
          group: 'Discounts and checkout',
          supportLinks: ['https://shopify.dev/docs/api/functions/reference/cart-checkout-validation'],
          types: [
            {
              identifier: 'cart_checkout_validation',
              externalIdentifier: 'cart_checkout_validation',
              externalName: 'cart_checkout_validation',
              gated: false,
              registrationLimit: 10,
              supportedFlavors: [
                {
                  name: 'Rust',
                  value: 'rust',
                  path: 'checkout/rust/cart-checkout-validation/default',
                },
              ],
              group: 'Discounts and checkout',
              category: expect.any(Function),
              configSchema: BaseFunctionConfigurationSchema,
              templateURL: 'https://github.com/Shopify/function-examples',
              helpURL: 'https://shopify.dev/docs/api/functions/reference/cart-checkout-validation',
              templatePath: expect.any(Function),
            },
          ],
        },
      ]),
    )

    expect(got).toEqual(
      expect.arrayContaining([
        {
          identifier: 'cart_transform',
          name: 'Function - Cart transformer',
          group: 'Discounts and checkout',
          supportLinks: [],
          types: [
            {
              identifier: 'cart_transform',
              externalIdentifier: 'cart_transform',
              externalName: 'cart_transform',
              gated: false,
              registrationLimit: 1,
              supportedFlavors: [
                {
                  name: 'Wasm',
                  value: 'wasm',
                  path: 'checkout/wasm/cart-transform/bundles',
                },
              ],
              group: 'Discounts and checkout',
              category: expect.any(Function),
              configSchema: BaseFunctionConfigurationSchema,
              templateURL: 'https://github.com/Shopify/function-examples',
              helpURL: undefined,
              templatePath: expect.any(Function),
            },
          ],
        },
      ]),
    )
  })
})
