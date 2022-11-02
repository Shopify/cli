import type {ExtensionTypes, ExternalExtensionTypes, UIExtensionTypes, UIExternalExtensionTypes} from '../../constants'

export function mapExtensionTypesToExternalExtensionTypes(extensionTypes: ExtensionTypes[]): ExternalExtensionTypes[] {
  return extensionTypes.map(mapExtensionTypeToExternalExtensionType)
}

export function mapExtensionTypeToExternalExtensionType(extensionType: ExtensionTypes): ExternalExtensionTypes {
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
    case 'customer_accounts_ui_extension':
      return 'customer_accounts_ui'
    default:
      return extensionType
  }
}

export function mapUIExternalExtensionTypeToUIExtensionType(
  externalExtensionType: UIExtensionTypes | UIExternalExtensionTypes,
): UIExtensionTypes {
  switch (externalExtensionType) {
    case 'post_purchase_ui':
      return 'checkout_post_purchase'
    case 'checkout_ui':
      return 'checkout_ui_extension'
    case 'subscription_ui':
      return 'product_subscription'
    case 'web_pixel':
      return 'web_pixel_extension'
    case 'pos_ui':
      return 'pos_ui_extension'
    case 'customer_accounts_ui':
      return 'customer_accounts_ui_extension'
    default:
      return externalExtensionType
  }
}

export function mapExternalExtensionTypeToExtensionType(
  externalExtensionType: ExternalExtensionTypes | ExtensionTypes,
): ExtensionTypes {
  switch (externalExtensionType) {
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
    case 'customer_accounts_ui':
      return 'customer_accounts_ui_extension'
    default:
      return externalExtensionType
  }
}
