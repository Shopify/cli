interface GetUIExensionResourceURLOptions {
  checkoutCartUrl?: string
  subscriptionProductUrl?: string
}

export function getUIExtensionResourceURL(
  uiExtensionType: string,
  options: GetUIExensionResourceURLOptions,
): {url: string} {
  if (uiExtensionType === 'checkout_ui_extension' && options.checkoutCartUrl) {
    return {url: options.checkoutCartUrl}
  }

  if (uiExtensionType === 'product_subscription') {
    return {url: options.subscriptionProductUrl ?? ''}
  }

  return {url: ''}
}
