import {buildCartURLIfNeeded, getExtensionPointTargetSurface} from './utilities.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {fetchProductVariant} from '../../../utilities/extensions/fetch-product-variant.js'
import {describe, expect, test, vi} from 'vitest'
import {isServiceAccountTokenSet} from '@shopify/cli-kit/node/session'

vi.mock('../../../utilities/extensions/fetch-product-variant.js')
vi.mock('@shopify/cli-kit/node/session')

const checkoutExtension = {shouldFetchCartUrl: () => true} as unknown as ExtensionInstance

describe('buildCartURLIfNeeded()', () => {
  test('returns the cart URL of the first product variant', async () => {
    vi.mocked(fetchProductVariant).mockResolvedValue('123')

    await expect(buildCartURLIfNeeded([checkoutExtension], 'store.myshopify.com')).resolves.toBe('/cart/123:1')
  })

  test('returns the given cart URL without looking up a product', async () => {
    vi.mocked(isServiceAccountTokenSet).mockReturnValue(true)

    await expect(buildCartURLIfNeeded([checkoutExtension], 'store.myshopify.com', '/cart/456:2')).resolves.toBe(
      '/cart/456:2',
    )
    expect(fetchProductVariant).not.toHaveBeenCalled()
  })

  test('keeps the given cart URL when no extension needs a cart yet', async () => {
    const otherExtension = {shouldFetchCartUrl: () => false} as unknown as ExtensionInstance

    await expect(buildCartURLIfNeeded([otherExtension], 'store.myshopify.com', '/cart/456:2')).resolves.toBe(
      '/cart/456:2',
    )
  })

  test('asks for a cart URL instead of looking up a product when a service account token is set', async () => {
    vi.mocked(isServiceAccountTokenSet).mockReturnValue(true)

    await expect(buildCartURLIfNeeded([checkoutExtension], 'store.myshopify.com')).rejects.toMatchObject({
      message: "A service account can't look up a product to preview checkout UI extensions.",
      tryMessage: expect.stringContaining('--checkout-cart-url'),
    })
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
