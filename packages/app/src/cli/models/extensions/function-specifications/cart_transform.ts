import {createFunctionSpecification} from '../functions.js'

const spec = createFunctionSpecification({
  identifier: 'cart_transform',
  externalIdentifier: 'cart_transform',
  externalName: 'Function - Cart transformer',
  gated: false,
  registrationLimit: 1,
  templatePath: (lang) => `checkout/${lang}/cart-transform/bundles`,
})

export default spec
