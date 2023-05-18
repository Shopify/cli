import {ExtensionTemplate} from '../../app/template.js'
import {uiFlavors} from '../common.js'

/**
 * Checkout UI template specification.
 */
const checkoutUIExtension: ExtensionTemplate = {
  identifier: 'checkout_ui',
  name: 'Checkout UI',
  group: 'Discounts and checkout',
  supportLinks: [],
  types: [
    {
      url: 'https://github.com/Shopify/cli',
      type: 'checkout_ui_extension',
      extensionPoints: [],
      supportedFlavors: uiFlavors('templates/ui-extensions/projects/checkout_ui_extension'),
    },
  ],
}

export default checkoutUIExtension
