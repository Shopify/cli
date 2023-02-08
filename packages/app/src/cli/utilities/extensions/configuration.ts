interface GetUIExensionResourceURLOptions {
  checkoutCartUrl?: string
  subscriptionProductUrl?: string
  checkoutEditorUrl?: string
}

export function getUIExtensionResourceURL(
  uiExtensionType: string,
  options: GetUIExensionResourceURLOptions,
  previewMode?: string,
): {url: string} {
  switch (uiExtensionType) {
    case 'checkout_ui_extension':
      return {url: previewMode === 'editor' ? options.checkoutEditorUrl! : options.checkoutCartUrl!}
    case 'product_subscription':
      return {url: options.subscriptionProductUrl ?? ''}
    default:
      return {url: ''}
  }
}
