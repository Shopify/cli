import {createFunctionSpecification} from '../functions.js'

const spec = createFunctionSpecification({
  identifier: 'delivery_customization',
  externalIdentifier: 'delivery_customization',
  externalName: 'Delivery customization',
  gated: true,
  templatePath: (lang) => `checkout/${lang}/delivery-customization/default`,
})

export default spec
