import {getExtensionOutputConfig} from './constants'
import {describe, expect, it} from 'vitest'

describe('get extension type output configuration', () => {
  it('obtain the correct configuration for extension type beacon_extension', () => {
    // Given
    const extensionType = 'beacon_extension'

    // When
    const extensionOutputConfig = getExtensionOutputConfig(extensionType)

    // Then
    expect(extensionOutputConfig).toEqual({
      humanKey: 'Beacon',
    })
  })

  it('obtain the correct configuration for extension type checkout_post_purchase', () => {
    // Given
    const extensionType = 'checkout_post_purchase'

    // When
    const extensionOutputConfig = getExtensionOutputConfig(extensionType)

    // Then
    expect(extensionOutputConfig).toEqual({
      humanKey: 'Post-purchase',
      helpURL: 'https://shopify.dev/apps/checkout/post-purchase',
    })
  })

  it('obtain the correct configuration for extension type theme', () => {
    // Given
    const extensionType = 'theme'

    // When
    const extensionOutputConfig = getExtensionOutputConfig(extensionType)

    // Then
    expect(extensionOutputConfig).toEqual({
      humanKey: 'Theme app',
    })
  })

  it('obtain the correct configuration for extension type checkout_ui_extension', () => {
    // Given
    const extensionType = 'checkout_ui_extension'

    // When
    const extensionOutputConfig = getExtensionOutputConfig(extensionType)

    // Then
    expect(extensionOutputConfig).toEqual({
      humanKey: 'Checkout UI',
    })
  })

  it('obtain the correct configuration for extension type product_subscription', () => {
    // Given
    const extensionType = 'product_subscription'

    // When
    const extensionOutputConfig = getExtensionOutputConfig(extensionType)

    // Then
    expect(extensionOutputConfig).toEqual({
      humanKey: 'Product subscription',
    })
  })

  it('obtain the correct configuration for extension type product_discounts', () => {
    // Given
    const extensionType = 'product_discounts'

    // When
    const extensionOutputConfig = getExtensionOutputConfig(extensionType)

    // Then
    expect(extensionOutputConfig).toEqual({
      humanKey: 'Product discount',
      helpURL: 'https://shopify.dev/apps/subscriptions/discounts',
      additionalHelp:
        'This function will use your app’s toml file to point to the discount UI that you add to your web/ folder.',
    })
  })

  it('obtain the correct configuration for extension type order_discounts', () => {
    // Given
    const extensionType = 'order_discounts'

    // When
    const extensionOutputConfig = getExtensionOutputConfig(extensionType)

    // Then
    expect(extensionOutputConfig).toEqual({
      humanKey: 'Order discount',
      helpURL: 'https://shopify.dev/apps/subscriptions/discounts',
      additionalHelp:
        'This function will use your app’s toml file to point to the discount UI that you add to your web/ folder.',
    })
  })

  it('obtain the correct configuration for extension type shipping_discounts', () => {
    // Given
    const extensionType = 'shipping_discounts'

    // When
    const extensionOutputConfig = getExtensionOutputConfig(extensionType)

    // Then
    expect(extensionOutputConfig).toEqual({
      humanKey: 'Shipping discount',
      helpURL: 'https://shopify.dev/apps/subscriptions/discounts',
      additionalHelp:
        'This function will use your app’s toml file to point to the discount UI that you add to your web/ folder.',
    })
  })

  it('obtain the correct configuration for extension type payment_methods', () => {
    // Given
    const extensionType = 'payment_methods'

    // When
    const extensionOutputConfig = getExtensionOutputConfig(extensionType)

    // Then
    expect(extensionOutputConfig).toEqual({
      humanKey: 'Payment method',
    })
  })

  it('obtain the correct configuration for extension type shipping_rate_presenter', () => {
    // Given
    const extensionType = 'shipping_rate_presenter'

    // When
    const extensionOutputConfig = getExtensionOutputConfig(extensionType)

    // Then
    expect(extensionOutputConfig).toEqual({
      humanKey: 'Shipping rate presenter',
    })
  })
})
