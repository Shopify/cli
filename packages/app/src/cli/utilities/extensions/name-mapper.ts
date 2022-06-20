import {ExtensionTypes, ExtensionTypeslKeys} from '../../constants'

export function convertExtensionTypesToExtensionTypeKeys(extensionTypes: ExtensionTypes[]): ExtensionTypeslKeys[] {
  return extensionTypes.map(convertExtensionTypeToExtensionTypeKey)
}

export function convertExtensionTypeToExtensionTypeKey(extensionType: ExtensionTypes): ExtensionTypeslKeys {
  switch (extensionType) {
    case 'checkout_post_purchase':
      return 'post_purchase_ui'
    case 'checkout_ui_extension':
      return 'checkout_ui'
    case 'product_discounts':
      return 'product_discount'
    case 'order_discounts':
      return 'order_discount'
    case 'shipping_discounts':
      return 'shipping_discount'
    case 'payment_methods':
      return 'payment_customization'
    case 'shipping_rate_presenter':
      return 'delivery_option_presenter'
    case 'product_subscription':
      return 'subscription_ui'
    case 'web_pixel_extension':
      return 'web_pixel'
    case 'pos_ui_extension':
      return 'pos_ui'
    case 'theme':
      return 'theme_app_extension'
    default:
      return extensionType
  }
}

export function convertExtensionTypeKeyToExtensionType(extensionTypeKey: ExtensionTypeslKeys): ExtensionTypes {
  switch (extensionTypeKey) {
    case 'post_purchase_ui':
      return 'checkout_post_purchase'
    case 'checkout_ui':
      return 'checkout_ui_extension'
    case 'product_discount':
      return 'product_discounts'
    case 'order_discount':
      return 'order_discounts'
    case 'shipping_discount':
      return 'shipping_discounts'
    case 'payment_customization':
      return 'payment_methods'
    case 'delivery_option_presenter':
      return 'shipping_rate_presenter'
    case 'subscription_ui':
      return 'product_subscription'
    case 'web_pixel':
      return 'web_pixel_extension'
    case 'pos_ui':
      return 'pos_ui_extension'
    case 'theme_app_extension':
      return 'theme'
    default:
      return extensionTypeKey
  }
}
