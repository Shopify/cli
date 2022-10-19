import {getExtensionOutputConfig} from './constants.js'
import {describe, expect, it} from 'vitest'

describe('get extension type output configuration', () => {
  it('obtain the correct configuration for extension type web_pixel_extension', () => {
    // Given
    const extensionType = 'web_pixel_extension'

    // When
    const extensionOutputConfig = getExtensionOutputConfig(extensionType)

    // Then
    expect(extensionOutputConfig).toEqual({
      humanKey: 'Web pixel',
    })
  })

  it('obtain the correct configuration for extension type checkout_post_purchase', () => {
    // Given
    const extensionType = 'checkout_post_purchase'

    // When
    const extensionOutputConfig = getExtensionOutputConfig(extensionType)

    // Then
    expect(extensionOutputConfig).toEqual({
      humanKey: 'Post-purchase UI',
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
      humanKey: 'Theme app extension',
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
      humanKey: 'Subscription UI',
    })
  })

  it('obtain the correct configuration for extension type product_discounts', () => {
    // Given
    const extensionType = 'product_discounts'

    // When
    const extensionOutputConfig = getExtensionOutputConfig(extensionType)

    // Then
    expect(extensionOutputConfig).toEqual({
      humanKey: 'Function - Product discount',
      helpURL: 'https://shopify.dev/apps/subscriptions/discounts',
    })
  })

  it('obtain the correct configuration for extension type order_discounts', () => {
    // Given
    const extensionType = 'order_discounts'

    // When
    const extensionOutputConfig = getExtensionOutputConfig(extensionType)

    // Then
    expect(extensionOutputConfig).toEqual({
      humanKey: 'Function - Order discount',
      helpURL: 'https://shopify.dev/apps/subscriptions/discounts',
    })
  })

  it('obtain the correct configuration for extension type shipping_discounts', () => {
    // Given
    const extensionType = 'shipping_discounts'

    // When
    const extensionOutputConfig = getExtensionOutputConfig(extensionType)

    // Then
    expect(extensionOutputConfig).toEqual({
      humanKey: 'Function - Shipping discount',
      helpURL: 'https://shopify.dev/apps/subscriptions/discounts',
    })
  })

  it('obtain the correct configuration for extension type payment_customization', () => {
    // Given
    const extensionType = 'payment_customization'

    // When
    const extensionOutputConfig = getExtensionOutputConfig(extensionType)

    // Then
    expect(extensionOutputConfig).toEqual({
      humanKey: 'Payment customization',
    })
  })

  it('obtain the correct configuration for extension type delivery_customization', () => {
    // Given
    const extensionType = 'delivery_customization'

    // When
    const extensionOutputConfig = getExtensionOutputConfig(extensionType)

    // Then
    expect(extensionOutputConfig).toEqual({
      humanKey: 'Delivery customization',
    })
  })

  it('obtain the correct configuration for extension type shipping_rate_presenter', () => {
    // Given
    const extensionType = 'shipping_rate_presenter'

    // When
    const extensionOutputConfig = getExtensionOutputConfig(extensionType)

    // Then
    expect(extensionOutputConfig).toEqual({
      humanKey: 'Delivery option presenter',
    })
  })
})
