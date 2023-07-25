import {ExtensionTemplate} from '../../app/template.js'
import {uiFlavors} from '../common.js'

/**
 * Product Subscription UI extension template specification.
 */
const productSubscriptionUIExtension: ExtensionTemplate = {
  identifier: 'subscription_ui',
  name: 'Subscription UI',
  defaultName: 'subscription-ui',
  group: 'Admin',
  supportLinks: [],
  types: [
    {
      url: 'https://github.com/Shopify/cli',
      type: 'product_subscription',
      extensionPoints: [],
      supportedFlavors: uiFlavors('templates/ui-extensions/projects/product_subscription'),
    },
  ],
}

export default productSubscriptionUIExtension
