import {getExtensionPointTargetSurface} from './utilities.js'
import {describe, expect, test} from 'vitest'

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

  test('returns "checkout" for a checkout UI extension target that starts with customer-account', async () => {
    expect(getExtensionPointTargetSurface('customer-account.order-status.block.render')).toBe('checkout')
    expect(getExtensionPointTargetSurface('customer-account.order-status.customer-information.render-after')).toBe(
      'checkout',
    )
    expect(getExtensionPointTargetSurface('customer-account.order-status.cart-line-item.render-after')).toBe('checkout')
    expect(getExtensionPointTargetSurface('customer-account.order-status.cart-line-list.render-after')).toBe('checkout')
  })

  test('returns "customer-accounts" for a Customer Account UI extension', async () => {
    expect(getExtensionPointTargetSurface('customer-account.dynamic.render')).toBe('customer-accounts')
  })

  test('returns "post_purchase" for a Post Purchase UI extension', async () => {
    expect(getExtensionPointTargetSurface('purchase.post.render')).toBe('post_purchase')
  })

  test('returns "point_of_sale" for a POS UI extension', async () => {
    expect(getExtensionPointTargetSurface('pos.home.tile.render')).toBe('point_of_sale')
  })
})
