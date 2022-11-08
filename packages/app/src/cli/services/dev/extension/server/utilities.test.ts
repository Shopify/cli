import {getRedirectUrl} from './utilities.js'
import {ExtensionDevOptions} from '../../extension.js'
import {testUIExtension} from '../../../../models/app/app.test-data.js'
import {describe, expect, it} from 'vitest'

describe('getRedirectURL()', () => {
  it('returns a URL with a URL param', () => {
    const extension = testUIExtension({
      devUUID: '123abc',
      surface: 'post_purchase',
      type: 'checkout_post_purchase',
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

  it('returns a URL with a dev param if the surface is checkout and the etension has a resourceURL', () => {
    const extension = testUIExtension({
      devUUID: '123abc',
      surface: 'checkout',
      type: 'checkout_ui_extension',
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
