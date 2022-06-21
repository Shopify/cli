import {
  ExtensionTypesHumanKeys,
  getExtensionOutputConfig,
  getExtensionTypeFromHumanKey,
  functionExtensions,
  getFunctionExtensionPointName,
} from './constants'
import {describe, expect, it, test} from 'vitest'

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
      humanKey: 'post-purchase UI',
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
      humanKey: 'subscription UI',
    })
  })

  it('obtain the correct configuration for extension type product_discounts', () => {
    // Given
    const extensionType = 'product_discounts'

    // When
    const extensionOutputConfig = getExtensionOutputConfig(extensionType)

    // Then
    expect(extensionOutputConfig).toEqual({
      humanKey: 'product discount',
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
      humanKey: 'order discount',
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
      humanKey: 'shipping discount',
      helpURL: 'https://shopify.dev/apps/subscriptions/discounts',
    })
  })

  it('obtain the correct configuration for extension type payment_methods', () => {
    // Given
    const extensionType = 'payment_methods'

    // When
    const extensionOutputConfig = getExtensionOutputConfig(extensionType)

    // Then
    expect(extensionOutputConfig).toEqual({
      humanKey: 'payment customization',
    })
  })

  it('obtain the correct configuration for extension type shipping_rate_presenter', () => {
    // Given
    const extensionType = 'shipping_rate_presenter'

    // When
    const extensionOutputConfig = getExtensionOutputConfig(extensionType)

    // Then
    expect(extensionOutputConfig).toEqual({
      humanKey: 'delivery option presenter',
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

  it('obtain the correct extension type for human key order discount', () => {
    // Given
    const humanKey: ExtensionTypesHumanKeys = 'order discount'

    // When
    const extensionType = getExtensionTypeFromHumanKey(humanKey)

    // Then
    expect(extensionType).toEqual('product_discounts')
  })

  it('obtain the correct extension type for human key product discount', () => {
    // Given
    const humanKey: ExtensionTypesHumanKeys = 'product discount'

    // When
    const extensionType = getExtensionTypeFromHumanKey(humanKey)

    // Then
    expect(extensionType).toEqual('product_discounts')
  })

  it('obtain the correct extension type for human key shipping discount', () => {
    // Given
    const humanKey: ExtensionTypesHumanKeys = 'shipping discount'

    // When
    const extensionType = getExtensionTypeFromHumanKey(humanKey)

    // Then
    expect(extensionType).toEqual('shipping_discounts')
  })

  it('obtain the correct extension type for human key payment customization', () => {
    // Given
    const humanKey: ExtensionTypesHumanKeys = 'payment customization'

    // When
    const extensionType = getExtensionTypeFromHumanKey(humanKey)

    // Then
    expect(extensionType).toEqual('payment_methods')
  })

  it('obtain the correct extension type for human key post-purchase UI', () => {
    // Given
    const humanKey: ExtensionTypesHumanKeys = 'post-purchase UI'

    // When
    const extensionType = getExtensionTypeFromHumanKey(humanKey)

    // Then
    expect(extensionType).toEqual('checkout_post_purchase')
  })

  it('obtain the correct extension type for human key subscription UI', () => {
    // Given
    const humanKey: ExtensionTypesHumanKeys = 'subscription UI'

    // When
    const extensionType = getExtensionTypeFromHumanKey(humanKey)

    // Then
    expect(extensionType).toEqual('product_subscription')
  })

  it('obtain the correct extension type for human key shipping rate representer', () => {
    // Given
    const humanKey: ExtensionTypesHumanKeys = 'delivery option presenter'

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

describe('getFunctionExtensionPointName', () => {
  test('it returns the right extension point mapper', () => {
    // Given
    const extensionPoints = {
      PRODUCT_DISCOUNTS: ['product_discounts'],
      ORDER_DISCOUNTS: ['order_discounts'],
      SHIPPING_DISCOUNTS: ['shipping_discounts'],
      PAYMENT_METHODS: ['payment_methods'],
      SHIPPING_METHODS: ['shipping_rate_presenter'],
    }

    functionExtensions.types.forEach((functionExtensionType) => {
      const extensionPoint = getFunctionExtensionPointName(functionExtensionType)
      expect(extensionPoints[extensionPoint].includes(functionExtensionType)).toBeTruthy()
    })
  })
})
