import {createFunctionSpecification} from '../functions.js'

const spec = createFunctionSpecification({
  identifier: 'cart_checkout_validation',
  externalIdentifier: 'cart_checkout_validation',
  externalName: 'Function - Cart and Checkout Validation',
  helpURL: 'https://shopify.dev/docs/api/functions/reference/cart-checkout-validation',
  templatePath: (lang) => `checkout/${lang}/cart-checkout-validation/default`,
})

export default spec
