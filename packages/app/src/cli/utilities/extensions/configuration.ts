interface GetUIExensionResourceURLOptions {
  checkoutCartUrl?: string
  subscriptionProductUrl?: string
}

export function getUIExtensionResourceURL(
  uiExtensionType: string,
  options: GetUIExensionResourceURLOptions,
): {url: string | undefined} {
  switch (uiExtensionType) {
    case 'checkout_ui_extension':
      return {url: options.checkoutCartUrl}
    case 'product_subscription':
      return {url: options.subscriptionProductUrl ?? ''}
    case 'company_location_details':
      console.log(`company location options=${options}`);
      return {url: ''}
    default:
      return {url: ''}
  }
}
