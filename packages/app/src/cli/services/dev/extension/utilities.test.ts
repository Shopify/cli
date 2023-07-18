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

  test('returns "customer-accounts" for a Customer Account UI extension', async () => {
    expect(getExtensionPointTargetSurface('customer-account.dynamic.render')).toBe('customer-accounts')
  })

  test('returns "post_purchase" for a Post Purchase UI extension', async () => {
    expect(getExtensionPointTargetSurface('purchase.post.render')).toBe('post_purchase')
  })

  test('returns "point_of_sale" for a POS UI extension', async () => {
    expect(getExtensionPointTargetSurface('retail.home.tile.render')).toBe('point_of_sale')
  })
})
