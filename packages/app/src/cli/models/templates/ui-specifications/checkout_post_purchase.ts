import {ExtensionTemplate} from '../../app/template.js'
import {uiFlavors} from '../common.js'

/**
 * Post-purchase UI template specification.
 */
const checkoutPostPurchaseExtension: ExtensionTemplate = {
  identifier: 'post_purchase_ui',
  name: 'Post-purchase UI',
  group: 'Discounts and checkout',
  supportLinks: ['https://shopify.dev/docs/apps/checkout/post-purchase'],
  types: [
    {
      url: 'https://github.com/Shopify/cli',
      type: 'checkout_post_purchase',
      extensionPoints: [],
      supportedFlavors: uiFlavors('templates/ui-extensions/projects/checkout_post_purchase'),
    },
  ],
}

export default checkoutPostPurchaseExtension
