import {UIExtensionTypes} from '../../constants.js'

interface GetUIExensionResourceURLOptions {
  checkoutCartUrl?: string
  subscriptionProductUrl?: string
}

export function getUIExtensionResourceURL(
  uiExtensionType: UIExtensionTypes,
  options: GetUIExensionResourceURLOptions,
): {url: string | undefined} {
  switch (uiExtensionType) {
    case 'checkout_ui_extension':
      return {url: options.checkoutCartUrl}
    case 'product_subscription':
      return {url: options.subscriptionProductUrl ?? ''}
    default:
      return {url: ''}
  }
}

export type UIExtensionSurface = ReturnType<typeof getUIExtensionSurface>

export function getUIExtensionSurface(uiExtensionType: UIExtensionTypes) {
  switch (uiExtensionType) {
    case 'checkout_ui_extension':
      return 'checkout'
    case 'checkout_post_purchase':
      return 'post_purchase'
    case 'customer_accounts_ui_extension':
      return 'customer_accounts'
    case 'pos_ui_extension':
      return 'pos'
    case 'product_subscription':
      return 'admin'
    case 'web_pixel_extension':
      // This value is mandatory but is not yet defined for web_pixel
      return 'unknown'
  }
}
