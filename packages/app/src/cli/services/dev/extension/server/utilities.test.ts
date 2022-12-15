import {getRedirectUrl, getExtensionPointRedirectUrl} from './utilities.js'
import {ExtensionDevOptions} from '../../extension.js'
import {testUIExtension} from '../../../../models/app/app.test-data.js'
import {UIExtension} from '../../../../models/app/extensions.js'
import {describe, expect, it} from 'vitest'

describe('getRedirectURL()', () => {
  it('returns a URL with a URL param', async () => {
    const extension = await testUIExtension({
      configuration: {type: 'product_subscription', name: 'test', metafields: []},
      devUUID: '123abc',
    })

    const options = {
      storeFqdn: 'example.myshopify.com',
      url: 'https://localhost:8081',
    } as unknown as ExtensionDevOptions

    const result = getRedirectUrl(extension, options)

    expect(result).toBe(
      'https://example.myshopify.com/admin/extensions-dev?url=https%3A%2F%2Flocalhost%3A8081%2Fextensions%2F123abc',
    )
  })

  it('returns a URL with a dev param if the surface is checkout and the etension has a resourceURL', async () => {
    const extension = await testUIExtension({
      configuration: {type: 'checkout_ui_extension', name: 'test', metafields: []},
      surface: 'checkout',
    })

    const options = {
      storeFqdn: 'example.myshopify.com',
      url: 'https://localhost:8081',
      checkoutCartUrl: 'mock/cart/url',
    } as unknown as ExtensionDevOptions

    const result = getRedirectUrl(extension, options)

    expect(result).toBe('https://example.myshopify.com/mock/cart/url?dev=https%3A%2F%2Flocalhost%3A8081%2Fextensions')
  })
})

describe('getExtensionPointRedirectUrl()', () => {
  it('returns Admin dev server URL if the extension point targets Admin', () => {
    const extension = {
      devUUID: '123abc',
    } as UIExtension

    const options = {
      storeFqdn: 'example.myshopify.com',
      url: 'https://localhost:8081',
    } as unknown as ExtensionDevOptions

    const result = getExtensionPointRedirectUrl('Admin::CheckoutEditor::RenderSettings', extension, options)

    expect(result).toBe(
      'https://example.myshopify.com/admin/extensions-dev?url=https%3A%2F%2Flocalhost%3A8081%2Fextensions%2F123abc',
    )
  })

  it('returns Checkout dev server URL if the extension point targets Checkout', () => {
    const extension = {
      devUUID: '123abc',
    } as UIExtension

    const options = {
      storeFqdn: 'example.myshopify.com',
      url: 'https://localhost:8081',
      checkoutCartUrl: 'mock/cart/url',
    } as unknown as ExtensionDevOptions

    const result = getExtensionPointRedirectUrl('Checkout::Dynamic::Render', extension, options)

    expect(result).toBe('https://example.myshopify.com/mock/cart/url?dev=https%3A%2F%2Flocalhost%3A8081%2Fextensions')
  })

  it('returns undefined if the extension point surface is not supported', () => {
    const extension = {
      devUUID: '123abc',
    } as UIExtension

    const options = {
      storeFqdn: 'example.myshopify.com',
      url: 'https://localhost:8081',
      checkoutCartUrl: 'mock/cart/url',
    } as unknown as ExtensionDevOptions

    expect(getExtensionPointRedirectUrl('ABC', extension, options)).toBeUndefined()
    expect(getExtensionPointRedirectUrl('SomeOtherArea::Test::Extension', extension, options)).toBeUndefined()
  })
})
