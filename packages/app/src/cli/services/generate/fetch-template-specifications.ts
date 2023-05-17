import {
  RemoteTemplateSpecificationsQuery,
  RemoteTemplateSpecificationsQuerySchema,
} from '../../api/graphql/template_specifications.js'
import {ExtensionTemplate} from '../../models/app/template.js'
import themeExtension from '../../models/templates/theme-specifications/theme.js'
import checkoutPostPurchaseExtension from '../../models/templates/ui-specifications/checkout_post_purchase.js'
import checkoutUIExtension from '../../models/templates/ui-specifications/checkout_ui_extension.js'
import customerAccountsUIExtension from '../../models/templates/ui-specifications/customer_accounts_ui_extension.js'
import posUIExtension from '../../models/templates/ui-specifications/pos_ui_extension.js'
import productSubscriptionUIExtension from '../../models/templates/ui-specifications/product_subscription.js'
import taxCalculationUIExtension from '../../models/templates/ui-specifications/tax_calculation.js'
import UIExtension from '../../models/templates/ui-specifications/ui_extension.js'
import webPixelUIExtension from '../../models/templates/ui-specifications/web_pixel_extension.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'

export async function fetchExtensionTemplates(token: string): Promise<ExtensionTemplate[]> {
  const remoteTemplates: RemoteTemplateSpecificationsQuerySchema = await partnersRequest(
    RemoteTemplateSpecificationsQuery,
    token,
  )
  return remoteTemplates.templateSpecifications.concat(localExtensionTemplates())
}

export function localExtensionTemplates() {
  return [
    themeExtension,
    checkoutPostPurchaseExtension,
    checkoutUIExtension,
    customerAccountsUIExtension,
    posUIExtension,
    productSubscriptionUIExtension,
    taxCalculationUIExtension,
    UIExtension,
    webPixelUIExtension,
  ]
}
