import {getExtensionOutputConfig} from './constants'
import {describe, expect, it} from 'vitest'

describe('get extension type output configuration', () => {
  it('obtain the correct configuration for extension type beacon_extension', () => {
    expect(getExtensionOutputConfig('beacon_extension')).toEqual({
      humanKey: 'Beacon',
    })
  })

  it('obtain the correct configuration for extension type checkout_post_purchase', () => {
    expect(getExtensionOutputConfig('checkout_post_purchase')).toEqual({
      humanKey: 'Post-purchase',
      helpURL: 'https://shopify.dev/apps/checkout/post-purchase',
    })
  })

  it('obtain the correct configuration for extension type theme', () => {
    expect(getExtensionOutputConfig('theme')).toEqual({
      humanKey: 'Theme app',
    })
  })

  it('obtain the correct configuration for extension type checkout_ui_extension', () => {
    expect(getExtensionOutputConfig('checkout_ui_extension')).toEqual({
      humanKey: 'Checkout UI',
    })
  })

  it('obtain the correct configuration for extension type product_subscription', () => {
    expect(getExtensionOutputConfig('product_subscription')).toEqual({
      humanKey: 'Product subscription',
    })
  })

  it('obtain the correct configuration for extension type product_discounts', () => {
    expect(getExtensionOutputConfig('product_discounts')).toEqual({
      humanKey: 'Product discount',
      helpURL: 'https://shopify.dev/apps/subscriptions/discounts',
      additionalHelp:
        'This function will use your app’s toml file to point to the discount UI that you add to your web/ folder.',
    })
  })

  it('obtain the correct configuration for extension type order_discounts', () => {
    expect(getExtensionOutputConfig('order_discounts')).toEqual({
      humanKey: 'Order discount',
      helpURL: 'https://shopify.dev/apps/subscriptions/discounts',
      additionalHelp:
        'This function will use your app’s toml file to point to the discount UI that you add to your web/ folder.',
    })
  })

  it('obtain the correct configuration for extension type shipping_discounts', () => {
    expect(getExtensionOutputConfig('shipping_discounts')).toEqual({
      humanKey: 'Shipping discount',
      helpURL: 'https://shopify.dev/apps/subscriptions/discounts',
      additionalHelp:
        'This function will use your app’s toml file to point to the discount UI that you add to your web/ folder.',
    })
  })

  it('obtain the correct configuration for extension type payment_methods', () => {
    expect(getExtensionOutputConfig('payment_methods')).toEqual({
      humanKey: 'Payment method',
    })
  })

  it('obtain the correct configuration for extension type shipping_rate_presenter', () => {
    expect(getExtensionOutputConfig('shipping_rate_presenter')).toEqual({
      humanKey: 'Shipping rate presenter',
    })
  })
})
