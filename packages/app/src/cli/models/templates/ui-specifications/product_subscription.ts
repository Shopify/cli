import {ExtensionTemplate} from '../../app/template.js'
import {uiFlavors} from '../common.js'

/**
 * Product Subscription UI extension template specification.
 */
const productSubscriptionUIExtension: ExtensionTemplate = {
  identifier: 'product_subscription',
  name: 'Subscription UI',
  group: 'Merchant admin',
  supportLinks: [],
  types: [
    {
      url: 'https://github.com/Shopify/cli',
      type: 'product_subscription',
      extensionPoints: [],
      supportedFlavors: uiFlavors('packages/app/templates/ui-extensions/projects/product_subscription'),
    },
  ],
}

export default productSubscriptionUIExtension
