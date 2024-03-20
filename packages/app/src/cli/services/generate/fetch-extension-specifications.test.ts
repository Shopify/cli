import {fetchSpecifications} from './fetch-extension-specifications.js'
import {testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {describe, expect, test} from 'vitest'

describe('fetchExtensionSpecifications', () => {
  test('returns the filtered and mapped results including theme', async () => {
    // Given/When
    const got = await fetchSpecifications({developerPlatformClient: testDeveloperPlatformClient(), apiKey: 'apiKey'})

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
  })
})
