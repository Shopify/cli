import {ExtensionTypesHumanKeys, getExtensionOutputConfig, getExtensionTypeFromHumanKey} from './constants'
import {describe, expect, it} from 'vitest'

describe('get extension type output configuration', () => {
  it('obtain the correct configuration for extension type web_pixel_extension', () => {
    // Given
    const extensionType = 'web_pixel_extension'

    // When
    const extensionOutputConfig = getExtensionOutputConfig(extensionType)

    // Then
    expect(extensionOutputConfig).toEqual({
      humanKey: 'web pixel',
    })
  })

  it('obtain the correct configuration for extension type checkout_post_purchase', () => {
    // Given
    const extensionType = 'checkout_post_purchase'

    // When
    const extensionOutputConfig = getExtensionOutputConfig(extensionType)

    // Then
    expect(extensionOutputConfig).toEqual({
      humanKey: 'post-purchase',
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
      humanKey: 'theme app extension',
    })
  })

  it('obtain the correct configuration for extension type checkout_ui_extension', () => {
    // Given
    const extensionType = 'checkout_ui_extension'

    // When
    const extensionOutputConfig = getExtensionOutputConfig(extensionType)

    // Then
    expect(extensionOutputConfig).toEqual({
      humanKey: 'checkout UI',
    })
  })

  it('obtain the correct configuration for extension type product_subscription', () => {
    // Given
    const extensionType = 'product_subscription'

    // When
    const extensionOutputConfig = getExtensionOutputConfig(extensionType)

    // Then
    expect(extensionOutputConfig).toEqual({
      humanKey: 'product subscription',
    })
  })

  it('obtain the correct configuration for extension type product_discounts', () => {
    // Given
    const extensionType = 'product_discounts'

    // When
    const extensionOutputConfig = getExtensionOutputConfig(extensionType)

    // Then
    expect(extensionOutputConfig).toEqual({
      humanKey: 'discount - products',
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
      humanKey: 'discount - orders',
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
      humanKey: 'discount - shipping rate',
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
      humanKey: 'payment method',
    })
  })

  it('obtain the correct configuration for extension type shipping_rate_presenter', () => {
    // Given
    const extensionType = 'shipping_rate_presenter'

    // When
    const extensionOutputConfig = getExtensionOutputConfig(extensionType)

    // Then
    expect(extensionOutputConfig).toEqual({
      humanKey: 'shipping rate presenter',
    })
  })
})

describe('get extension type from human key', () => {
  it('obtain the correct extension type for human key web pixel', () => {
    // Given
    const humanKey: ExtensionTypesHumanKeys = 'web pixel'

    // When
    const extensionType = getExtensionTypeFromHumanKey(humanKey)

    // Then
    expect(extensionType).toEqual('web_pixel_extension')
  })

  it('obtain the correct extension type for human key discount - orders', () => {
    // Given
    const humanKey: ExtensionTypesHumanKeys = 'discount - orders'

    // When
    const extensionType = getExtensionTypeFromHumanKey(humanKey)

    // Then
    expect(extensionType).toEqual('product_discounts')
  })

  it('obtain the correct extension type for human key discount - products', () => {
    // Given
    const humanKey: ExtensionTypesHumanKeys = 'discount - products'

    // When
    const extensionType = getExtensionTypeFromHumanKey(humanKey)

    // Then
    expect(extensionType).toEqual('product_discounts')
  })

  it('obtain the correct extension type for human key discount - shipping rate', () => {
    // Given
    const humanKey: ExtensionTypesHumanKeys = 'discount - shipping rate'

    // When
    const extensionType = getExtensionTypeFromHumanKey(humanKey)

    // Then
    expect(extensionType).toEqual('shipping_discounts')
  })

  it('obtain the correct extension type for human key payment method', () => {
    // Given
    const humanKey: ExtensionTypesHumanKeys = 'payment method'

    // When
    const extensionType = getExtensionTypeFromHumanKey(humanKey)

    // Then
    expect(extensionType).toEqual('payment_methods')
  })

  it('obtain the correct extension type for human key post-purchase', () => {
    // Given
    const humanKey: ExtensionTypesHumanKeys = 'post-purchase'

    // When
    const extensionType = getExtensionTypeFromHumanKey(humanKey)

    // Then
    expect(extensionType).toEqual('checkout_post_purchase')
  })

  it('obtain the correct extension type for human key product subscription', () => {
    // Given
    const humanKey: ExtensionTypesHumanKeys = 'product subscription'

    // When
    const extensionType = getExtensionTypeFromHumanKey(humanKey)

    // Then
    expect(extensionType).toEqual('product_subscription')
  })

  it('obtain the correct extension type for human key shipping rate representer', () => {
    // Given
    const humanKey: ExtensionTypesHumanKeys = 'shipping rate presenter'

    // When
    const extensionType = getExtensionTypeFromHumanKey(humanKey)

    // Then
    expect(extensionType).toEqual('shipping_rate_presenter')
  })

  it('obtain the correct extension type for human key shipping theme app extension', () => {
    // Given
    const humanKey: ExtensionTypesHumanKeys = 'theme app extension'

    // When
    const extensionType = getExtensionTypeFromHumanKey(humanKey)

    // Then
    expect(extensionType).toEqual('theme')
  })

  it('obtain the correct extension type for human key shipping theme checkout UI', () => {
    // Given
    const humanKey: ExtensionTypesHumanKeys = 'checkout UI'

    // When
    const extensionType = getExtensionTypeFromHumanKey(humanKey)

    // Then
    expect(extensionType).toEqual('checkout_ui_extension')
  })
})
