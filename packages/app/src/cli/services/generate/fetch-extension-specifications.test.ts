import {fetchSpecifications} from './fetch-extension-specifications.js'
import {testRemoteSpecifications} from '../../models/app/app.test-data.js'
import {partnersRequest} from '../app/partners-request.js'
import {describe, expect, it, vi} from 'vitest'
import {Config} from '@oclif/core'

vi.mock('../app/partners-request.js')

describe('fetchExtensionSpecifications', () => {
  it('returns the filtered and mapped results including theme and functions', async () => {
    // Given
    vi.mocked(partnersRequest).mockResolvedValue({extensionSpecifications: testRemoteSpecifications})

    // When
    const got = await fetchSpecifications({token: 'token', apiKey: 'apiKey', config: new Config({root: ''})})

    // Then
    expect(got).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalName: 'Post-purchase UI',
          identifier: 'checkout_post_purchase',
          externalIdentifier: 'checkout_post_purchase_external',
          registrationLimit: 1,
          surface: 'post_purchase',
        }),
      ]),
    )

    expect(got).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalName: 'Subscription UI',
          identifier: 'product_subscription',
          externalIdentifier: 'product_subscription_external',
          registrationLimit: 1,
          surface: 'admin',
        }),
      ]),
    )

    expect(got).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalName: 'UI Extension',
          identifier: 'ui_extension',
          externalIdentifier: 'ui_extension_external',
          registrationLimit: 50,
          surface: 'all',
        }),
      ]),
    )

    expect(got).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalName: 'Customer Accounts',
          identifier: 'customer_accounts_ui_extension',
          externalIdentifier: 'customer_accounts_ui_extension_external',
          registrationLimit: 10,
          surface: 'customer_accounts',
        }),
      ]),
    )

    expect(got).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Product Subscription',
          externalName: 'Subscription UI',
          identifier: 'product_subscription',
          externalIdentifier: 'product_subscription_external',
          registrationLimit: 1,
          surface: 'admin',
        }),
      ]),
    )

    expect(got).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Online Store - App Theme Extension',
          externalName: 'Theme App Extension',
          identifier: 'theme',
          externalIdentifier: 'theme_external',
          registrationLimit: 1,
          surface: undefined,
        }),
      ]),
    )

    expect(got).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalName: 'Function - Order discount',
          identifier: 'order_discounts',
          externalIdentifier: 'order_discount',
          registrationLimit: 10,
          helpURL: 'https://shopify.dev/docs/apps/discounts',
        }),
      ]),
    )
  })
})
