import {createFunctionSpecification} from '../functions.js'

const spec = createFunctionSpecification({
  identifier: 'cart_transform',
  externalIdentifier: 'cart_transform',
  externalName: 'Function - Cart transform',
  gated: false,
  registrationLimit: 1,
  templatePath: (lang) => `checkout/${lang}/cart-transform/default`,
})

export default spec
