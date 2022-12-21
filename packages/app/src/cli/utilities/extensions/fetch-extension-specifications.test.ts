import {fetchSpecifications} from './fetch-extension-specifications.js'
import {testRemoteSpecifications} from '../../models/app/app.test-data.js'
import {describe, expect, it, vi} from 'vitest'
import {api} from '@shopify/cli-kit'

vi.mock('@shopify/cli-kit', async () => {
  const cliKit: any = await vi.importActual('@shopify/cli-kit')
  return {
    ...cliKit,
    api: {
      partners: {
        request: vi.fn(),
      },
      graphql: cliKit.api.graphql,
    },
  }
})

describe('fetchExtensionSpecifications', () => {
  it('returns the filtered and mapped results including theme and functions', async () => {
    // Given
    vi.mocked(api.partners.request).mockResolvedValue({extensionSpecifications: testRemoteSpecifications})

    // When
    const got = await fetchSpecifications('token', 'apiKey')

    // Then
    expect(got).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalName: 'Post-purchase UI',
          identifier: 'checkout_post_purchase',
          externalIdentifier: 'post_purchase_ui',
          registrationLimit: 1,
          surface: 'checkout',
        }),
        expect.objectContaining({
          externalName: 'Theme App Extension',
          identifier: 'theme',
          externalIdentifier: 'theme_app_extension',
          registrationLimit: 1,
        }),
        expect.objectContaining({
          externalName: 'Subscription UI',
          identifier: 'product_subscription',
          externalIdentifier: 'subscription_ui',
          registrationLimit: 1,
          surface: 'admin',
        }),
        expect.objectContaining({
          externalName: 'UI Extension',
          identifier: 'ui_extension',
          externalIdentifier: 'ui_extension',
          registrationLimit: 50,
          surface: 'all',
        }),
        expect.objectContaining({
          externalName: 'Customer Accounts',
          identifier: 'customer_accounts_ui_extension',
          externalIdentifier: 'customer_accounts_ui_extension',
          registrationLimit: 10,
          surface: 'customer_accounts',
        }),
        expect.objectContaining({
          name: 'Checkout Extension',
          externalName: 'Checkout UI',
          identifier: 'checkout_ui_extension',
          externalIdentifier: 'checkout_ui',
          registrationLimit: 5,
          surface: 'checkout',
        }),
        expect.objectContaining({
          name: 'Product Subscription',
          externalName: 'Subscription UI',
          identifier: 'product_subscription',
          externalIdentifier: 'subscription_ui',
          registrationLimit: 1,
          surface: 'admin',
        }),
        expect.objectContaining({
          name: 'Product Subscription',
          externalName: 'Subscription UI',
          identifier: 'product_subscription',
          externalIdentifier: 'subscription_ui',
          registrationLimit: 1,
          surface: 'admin',
        }),
        expect.objectContaining({
          name: 'Online Store - App Theme Extension',
          externalName: 'Theme App Extension',
          identifier: 'theme',
          externalIdentifier: 'theme_app_extension',
          registrationLimit: 1,
          surface: undefined,
        }),
        expect.objectContaining({
          externalName: 'Function - Order discount',
          identifier: 'order_discounts',
          externalIdentifier: 'order_discount',
          registrationLimit: 10,
          helpURL: 'https://shopify.dev/apps/subscriptions/discounts',
        }),
      ]),
    )
  })
})
