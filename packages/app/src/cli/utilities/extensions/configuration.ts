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
