import {getRedirectUrl, getExtensionPointRedirectUrl} from './utilities.js'
import {ExtensionDevOptions} from '../../extension.js'
import {testUIExtension} from '../../../../models/app/app.test-data.js'
import {ExtensionInstance} from '../../../../models/extensions/extension-instance.js'
import {describe, expect, test, vi} from 'vitest'
import {isSpinEnvironment} from '@shopify/cli-kit/node/context/spin'

vi.mock('@shopify/cli-kit/node/context/local')
vi.mock('@shopify/cli-kit/node/system')
vi.mock('@shopify/cli-kit/node/context/spin')

describe('getRedirectURL()', () => {
  test('returns a URL with a URL param', async () => {
    const extension = await testUIExtension({
      configuration: {type: 'product_subscription', name: 'test', metafields: []},
      devUUID: '123abc',
    })

    // Overwrite the surface to be admin (we don't have real values in tests)
    extension.specification.surface = 'admin'

    const options = {
      storeFqdn: 'example.myshopify.com',
      url: 'https://localhost:8081',
    } as unknown as ExtensionDevOptions

    const result = getRedirectUrl(extension, options)

    expect(result).toBe(
      'https://example.myshopify.com/admin/extensions-dev?url=https%3A%2F%2Flocalhost%3A8081%2Fextensions%2F123abc',
    )
  })

  test('returns a URL with a dev param if the surface is checkout and the etension has a resourceURL', async () => {
    const extension = await testUIExtension({
      configuration: {type: 'checkout_ui_extension', name: 'test', metafields: []},
    })

    // Overwrite the surface to be checkout (we don't have real values in tests)
    extension.specification.surface = 'checkout'

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
  test.each(['Admin::CheckoutEditor::RenderSettings', 'admin.checkout-editor.render-settings'])(
    'returns Admin dev server URL if the extension point targets Admin using naming convention: %s',
    (extensionPoint: string) => {
      const extension = {
        devUUID: '123abc',
      } as ExtensionInstance

      const options = {
        storeFqdn: 'example.myshopify.com',
        url: 'https://localhost:8081',
      } as unknown as ExtensionDevOptions

      const result = getExtensionPointRedirectUrl(extensionPoint, extension, options)

      expect(result).toBe(
        `https://example.myshopify.com/admin/extensions-dev?url=https%3A%2F%2Flocalhost%3A8081%2Fextensions%2F123abc&target=${encodeURIComponent(
          extensionPoint,
        )}`,
      )
    },
  )

  test('returns Checkout dev server URL if the extension point targets Checkout', () => {
    const extension = {
      devUUID: '123abc',
    } as ExtensionInstance

    const options = {
      storeFqdn: 'example.myshopify.com',
      url: 'https://localhost:8081',
      checkoutCartUrl: 'mock/cart/url',
    } as unknown as ExtensionDevOptions

    const result = getExtensionPointRedirectUrl('Checkout::Dynamic::Render', extension, options)

    expect(result).toBe('https://example.myshopify.com/mock/cart/url?dev=https%3A%2F%2Flocalhost%3A8081%2Fextensions')
  })

  test('returns customer account URL on shopify.com if the target is a customer account target and env is not spin', () => {
    vi.mocked(isSpinEnvironment).mockReturnValue(false)
    const extension = {
      devUUID: '123abc',
    } as ExtensionInstance

    const options = {
      storeFqdn: 'example.myshopify.com',
      storeId: '123456789',
      url: 'https://localhost:8081',
    } as unknown as ExtensionDevOptions

    const result = getExtensionPointRedirectUrl('customer-account.page.render', extension, options)

    expect(result).toBe(
      'https://shopify.com/123456789/account/extensions-development?origin=https%3A%2F%2Flocalhost%3A8081%2Fextensions&extensionId=123abc&source=CUSTOMER_ACCOUNT_EXTENSION&target=customer-account.page.render',
    )
  })

  test('returns customer account URL on a spin shopify domain if it is in a spin env', () => {
    vi.mocked(isSpinEnvironment).mockReturnValue(true)
    const extension = {
      devUUID: '123abc',
    } as ExtensionInstance

    const options = {
      storeFqdn: 'shop1.shopify.spin-instance.us.spin.dev',
      storeId: '123456789',
      url: 'https://localhost:8081',
    } as unknown as ExtensionDevOptions

    const result = getExtensionPointRedirectUrl('customer-account.page.render', extension, options)

    expect(result).toBe(
      'https://shopify.spin-instance.us.spin.dev/123456789/account/extensions-development?origin=https%3A%2F%2Flocalhost%3A8081%2Fextensions&extensionId=123abc&source=CUSTOMER_ACCOUNT_EXTENSION&target=customer-account.page.render',
    )
  })

  test('returns customer account URL on shopify.com if the extension point uses legacy customer account target and env is not spin', () => {
    vi.mocked(isSpinEnvironment).mockReturnValue(false)
    const extension = {
      devUUID: '123abc',
    } as ExtensionInstance

    const options = {
      storeFqdn: 'example.myshopify.com',
      storeId: '123456789',
      url: 'https://localhost:8081',
    } as unknown as ExtensionDevOptions

    const result = getExtensionPointRedirectUrl('CustomerAccount::FullPage::RenderWithin', extension, options)

    expect(result).toBe(
      'https://shopify.com/123456789/account/extensions-development?origin=https%3A%2F%2Flocalhost%3A8081%2Fextensions&extensionId=123abc&source=CUSTOMER_ACCOUNT_EXTENSION&target=CustomerAccount%3A%3AFullPage%3A%3ARenderWithin',
    )
  })

  test('returns undefined if the extension point surface is not supported', () => {
    const extension = {
      devUUID: '123abc',
    } as ExtensionInstance

    const options = {
      storeFqdn: 'example.myshopify.com',
      url: 'https://localhost:8081',
      checkoutCartUrl: 'mock/cart/url',
    } as unknown as ExtensionDevOptions

    expect(getExtensionPointRedirectUrl('ABC', extension, options)).toBeUndefined()
    expect(getExtensionPointRedirectUrl('SomeOtherArea::Test::Extension', extension, options)).toBeUndefined()
  })
})
