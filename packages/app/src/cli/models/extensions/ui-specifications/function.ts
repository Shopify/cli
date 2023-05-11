import {createExtensionSpecification} from '../ui.js'
import {BaseFunctionConfigurationSchema} from '../schemas.js'
import {defaultFunctionsFlavors} from '../../../constants.js'
import {ExtensionCategory} from '../../app/extensions.js'

const spec = createExtensionSpecification({
  identifier: 'function',
  additionalIdentifiers: [
    'order_discounts',
    'cart_checkout_validation',
    'cart_transform',
    'delivery_customization',
    'payment_customization',
    'product_discounts',
    'shipping_discounts',
    'fulfillment_constraints',
  ],
  surface: 'admin',
  schema: BaseFunctionConfigurationSchema,
  supportedFlavors: defaultFunctionsFlavors,
  partnersWebIdentifier: 'function',
  graphQLType: 'function',
  isPreviewable: false,
  category: (): ExtensionCategory => 'function',
})

export default spec
