import {buildCartURLIfNeeded, getExtensionPointTargetSurface} from './utilities.js'
import {testUIExtension} from '../../../models/app/app.test-data.js'
import {fetchProductVariant} from '../../../utilities/extensions/fetch-product-variant.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../../utilities/extensions/fetch-product-variant.js')

describe('buildCartURLIfNeeded()', () => {
  beforeEach(() => {
    vi.mocked(fetchProductVariant).mockResolvedValue('42')
  })

  test('builds a cart URL from the first product variant of the store', async () => {
    const checkoutExtension = await testUIExtension({type: 'checkout_post_purchase'})

    await expect(buildCartURLIfNeeded([checkoutExtension], 'my-store.myshopify.com')).resolves.toBe('/cart/42:1')
    expect(fetchProductVariant).toHaveBeenCalledWith('my-store.myshopify.com')
  })

  test('returns the provided cart URL without querying the store', async () => {
    const checkoutExtension = await testUIExtension({type: 'checkout_post_purchase'})

    await expect(buildCartURLIfNeeded([checkoutExtension], 'my-store.myshopify.com', '/cart/7:1')).resolves.toBe(
      '/cart/7:1',
    )
    expect(fetchProductVariant).not.toHaveBeenCalled()
  })

  test('returns undefined when no extension needs a cart URL', async () => {
    const subscriptionExtension = await testUIExtension({type: 'product_subscription'})

    await expect(
      buildCartURLIfNeeded([subscriptionExtension], 'my-store.myshopify.com', '/cart/7:1'),
    ).resolves.toBeUndefined()
    expect(fetchProductVariant).not.toHaveBeenCalled()
  })
})

describe('getExtensionPointTargetSurface()', () => {
  test('returns "admin" for an Admin UI extension', async () => {
    expect(getExtensionPointTargetSurface('admin.product-details.block.render')).toBe('admin')
  })

  test('returns "checkout" for a Checkout UI extension', async () => {
    expect(getExtensionPointTargetSurface('purchase.checkout.block.render')).toBe('checkout')
    expect(getExtensionPointTargetSurface('Checkout::Dynamic::Render')).toBe('checkout')
  })

  test('returns "checkout" for a UI extension targeting purchase.* where the page is not explicitly checkout', async () => {
    expect(getExtensionPointTargetSurface('purchase.cart-line-item.line-components.render')).toBe('checkout')
    expect(getExtensionPointTargetSurface('purchase.thank-you.block.render')).toBe('checkout')
    expect(getExtensionPointTargetSurface('purchase.thank-you.contact-information.render-after')).toBe('checkout')
    expect(getExtensionPointTargetSurface('purchase.thank-you.cart-line-item.render-after')).toBe('checkout')
    expect(getExtensionPointTargetSurface('purchase.thank-you.cart-line-list.render-after')).toBe('checkout')
  })

  test('returns "customer-accounts" for a Customer Account UI extension', async () => {
    expect(getExtensionPointTargetSurface('customer-account.dynamic.render')).toBe('customer-accounts')
    expect(getExtensionPointTargetSurface('customer-account.order-status.block.render')).toBe('customer-accounts')
    expect(getExtensionPointTargetSurface('customer-account.order-status.customer-information.render-after')).toBe(
      'customer-accounts',
    )
    expect(getExtensionPointTargetSurface('customer-account.order-status.cart-line-item.render-after')).toBe(
      'customer-accounts',
    )
    expect(getExtensionPointTargetSurface('customer-account.order-status.cart-line-list.render-after')).toBe(
      'customer-accounts',
    )
  })

  test('returns "post_purchase" for a Post Purchase UI extension', async () => {
    expect(getExtensionPointTargetSurface('purchase.post.render')).toBe('post_purchase')
  })

  test('returns "point_of_sale" for a POS UI extension', async () => {
    expect(getExtensionPointTargetSurface('pos.home.tile.render')).toBe('point_of_sale')
  })
})
